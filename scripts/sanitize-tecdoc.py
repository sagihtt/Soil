#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOIL B2B Automotive Platform — TECDOC Data Sanitization & Standardization Pipeline
Reads raw TecDoc .xlsx files across OLEO, FILTRO_OLEO, FILTRO_AR, and FILTRO_COMBUSTIVEL,
eliminates pure BEVs and dummy filter placeholders, applies sibling cross-reference inheritance,
maps every vehicle to OEM-accurate oil/transmission/filter catalogs, merges the curated
Brazilian high-turnover fleet (Cars, SUVs/Pickups, Trucks/Vans, Motorcycles), and exports
tecdoc-sanitized.json + 003_seed_tecdoc_national_fleet.sql.
"""

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
import openpyxl
import openpyxl.worksheet.filters as wf
from curated_fleet_data import CANONICAL_CATALOGS, CURATED_BRAZILIAN_FLEET

# 1. Bypass broken <autoFilter ref="..."> tags in TecDoc Excel exports
_orig_autofilter_init = wf.AutoFilter.__init__


def _safe_autofilter_init(self, ref=None, filterColumn=(), sortState=None, extLst=None):
    try:
        _orig_autofilter_init(self, ref=ref, filterColumn=filterColumn, sortState=sortState, extLst=extLst)
    except ValueError:
        _orig_autofilter_init(self, ref="A1:B1", filterColumn=(), sortState=None, extLst=None)


wf.AutoFilter.__init__ = _safe_autofilter_init

TECDOC_DIR = r"C:\Users\thiag\Documents\ADS\(01)-2026\old\ProjetoMorto-SOIL\soil\TECDOC"
OUTPUT_JSON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "apps",
    "api",
    "src",
    "infra",
    "database",
    "tecdoc-sanitized.json",
)

MANUFACTURER_MAP = {
    "ABARTH": "Abarth",
    "ACURA": "Acura",
    "ALFA_ROMEO": "Alfa Romeo",
    "ALFA ROMEO": "Alfa Romeo",
    "ALPINA": "Alpina",
    "ASIA_MOTORS": "Asia Motors",
    "ASIA MOTORS": "Asia Motors",
    "ASTON_MARTIN": "Aston Martin",
    "ASTON MARTIN": "Aston Martin",
    "AUDI": "Audi",
    "BENTLEY": "Bentley",
    "BMW": "BMW",
    "BYD": "BYD",
    "CADILLAC": "Cadillac",
    "CHANGAN": "Changan",
    "CHERY": "CAOA Chery",
    "CHEVROLET": "Chevrolet",
    "CHRYSLER": "Chrysler",
    "CITROEN": "Citroën",
    "CITROËN": "Citroën",
    "DAEWOO": "Daewoo",
    "DAIHATSU": "Daihatsu",
    "DODGE": "Dodge",
    "DS": "DS",
    "FERRARI": "Ferrari",
    "FIAT": "Fiat",
    "FORD": "Ford",
    "FORD_USA": "Ford",
    "FORD USA": "Ford",
    "GEELY": "Geely",
    "GENESIS": "Genesis",
    "GMC": "GMC",
    "HAVAL": "GWM Haval",
    "HONDA": "Honda",
    "HYUNDAI": "Hyundai",
    "INFINITI": "Infiniti",
    "IVECO": "Iveco",
    "JAC": "JAC",
    "JAGUAR": "Jaguar",
    "JEEP": "Jeep",
    "KIA": "Kia",
    "LADA": "Lada",
    "LAMBORGHINI": "Lamborghini",
    "LAND_ROVER": "Land Rover",
    "LAND ROVER": "Land Rover",
    "LEXUS": "Lexus",
    "LIFAN": "Lifan",
    "LINCOLN": "Lincoln",
    "LOTUS": "Lotus",
    "MAHINDRA": "Mahindra",
    "MASERATI": "Maserati",
    "MAZDA": "Mazda",
    "MCLAREN": "McLaren",
    "MERCEDES-BENZ": "Mercedes-Benz",
    "MG_(SAIC)": "MG",
    "MG (SAIC)": "MG",
    "MG": "MG",
    "MINI": "Mini",
    "MITSUBISHI": "Mitsubishi",
    "NISSAN": "Nissan",
    "OPEL": "Opel",
    "PEUGEOT": "Peugeot",
    "PONTIAC": "Pontiac",
    "PORSCHE": "Porsche",
    "RAM": "Ram",
    "RENAULT": "Renault",
    "ROLLS-ROYCE": "Rolls-Royce",
    "SEAT": "Seat",
    "SMART": "Smart",
    "SSANGYONG": "SsangYong",
    "SUBARU": "Subaru",
    "SUZUKI": "Suzuki",
    "TOYOTA": "Toyota",
    "VOLVO": "Volvo",
    "VW": "Volkswagen",
    "VOLKSWAGEN": "Volkswagen",
    "YAMAHA": "Yamaha",
}

UPPERCASE_TOKENS = {
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "TSI", "TFSI", "TDI", "BITDI", "SDI", "FSI", "GTE", "GTI", "GTS", "GLI",
    "VR6", "V6", "V8", "V10", "V12", "W12", "8V", "12V", "16V", "20V", "24V", "32V",
    "MPI", "SPI", "IE", "EFI", "MPFI", "VHC", "VHCE", "SPE/4", "T270", "TD350", "T200",
    "GSE", "THP", "HDI", "JTD", "MULTIJET", "CRD", "CDTI", "CTDI", "DTI", "DCI",
    "TCE", "SCE", "CVT", "AT", "MT", "DSG", "PDK", "4WD", "AWD", "FWD", "RWD",
    "SUV", "SW", "SW4", "CR-V", "HR-V", "WR-V", "ZR-V", "RAV4", "IX35", "HB20", "HB20S", "HB20X",
    "C3", "C4", "C5", "C6", "C8", "DS3", "DS4", "DS5", "A1", "A3", "A4", "A5", "A6", "A7", "A8",
    "Q2", "Q3", "Q5", "Q7", "Q8", "TT", "RS3", "RS4", "RS5", "RS6", "RS7", "R8",
    "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z3", "Z4", "M2", "M3", "M4", "M5", "M6", "M8",
    "SLK", "CLK", "GLC", "GLE", "GLA", "GLB", "GLS", "CLA", "CLS", "SL", "SLC", "AMG",
    "LT", "LTZ", "LS", "SL", "SV", "SE", "SEL", "XEI", "XLI", "XLS", "XLT", "SR", "SRV", "SRX",
    "GL", "GLS", "GLX", "EX", "EXL", "LX", "LXL", "LXS", "DX", "SX", "HLX", "ELX", "HGT",
    "CS", "CD", "CE", "S10", "D20", "D10", "C10", "C20", "A10", "A20", "F-100", "F-150", "F-250", "F-1000",
    "L200", "ASX", "TR4", "PAJERO", "XC40", "XC60", "XC90", "S60", "S90", "V40", "V60",
    "JCW", "GT", "RS", "ST", "XR3", "CL", "CLI", "MI", "SSI", "MSI", "GSI", "SRT", "HEMI",
    "DOHC", "SOHC", "OHC", "VVTI", "VVT-I", "I-VTEC", "VTEC", "MIVEC", "ECOTEC", "DURATEC",
    "ZETEC", "ROCAM", "SIGMA", "FIRE", "EVO", "ETORQ", "CRDI", "DID", "DI-D", "D4D", "D-4D",
    "CDI", "TGDI", "GDI", "DM-I", "HEV", "PHEV",
}

# Only unambiguous SUV, Pickup, and Utility model names (NO trim codes like LX, HR, XV, 1500!)
UTILITY_MODEL_KEYWORDS = [
    r"\bSUV\b", r"\bPICK-?UP\b", r"\bCABINE\b", r"\bFURG[AÃ]O\b", r"\bVAN\b",
    r"\bCOMPASS\b", r"\bRENEGADE\b", r"\bCOMMANDER\b", r"\bCHEROKEE\b", r"\bWRANGLER\b", r"\bGLADIATOR\b",
    r"\bTORO\b", r"\bSTRADA\b", r"\bFIORINO\b", r"\bDOBLO\b", r"\bPULSE\b", r"\bFASTBACK\b", r"\bTITANO\b", r"\bFREEMONT\b",
    r"\bS10\b", r"\bTRAILBLAZER\b", r"\bTRACKER\b", r"\bBLAZER\b", r"\bBONANZA\b", r"\bD20\b", r"\bVERANEIO\b",
    r"\bSILVERADO\b", r"\bMONTANA\b", r"\bCAPTIVA\b", r"\bEQUINOX\b", r"\bSPIN\b", r"\bZAFIRA\b", r"\bMERIVA\b",
    r"\bA\s*10\b", r"\bA\s*20\b", r"\bC\s*10\b", r"\bC\s*20\b", r"\bSUBURBAN\b", r"\bTAHOE\b",
    r"\bHILUX\b", r"\bSW4\b", r"\bRAV\s*4\b", r"\bCOROLLA CROSS\b", r"\bBANDEIRANTE\b", r"\bLAND CRUISER\b", r"\bFJ CRUISER\b", r"\bHIGHLANDER\b", r"\bTUNDRA\b",
    r"\bRANGER\b", r"\bECOSPORT\b", r"\bBRONCO\b", r"\bMAVERICK CABINE\b", r"\bTERRITORY\b", r"\bEDGE\b", r"\bEXPLORER\b", r"\bF-?150\b", r"\bF-?250\b", r"\bF-?1000\b", r"\bCOURIER\b", r"\bPAMPA\b", r"\bRURAL\b",
    r"\bAMAROK\b", r"\bTIGUAN\b", r"\bT-CROSS\b", r"\bNIVUS\b", r"\bTAOS\b", r"\bTERA\b", r"\bTOUAREG\b", r"\bSAVEIRO\b", r"\bKOMBI\b",
    r"\bHR-V\b", r"\bCR-V\b", r"\bWR-V\b", r"\bZR-V\b",
    r"\bCRETA\b", r"\bTUCSON\b", r"\bIX35\b", r"\bSANTA F[EÉ]\b", r"\bVERACRUZ\b", r"\bGALLOPER\b", r"\bTERRACAN\b", r"\bPALISADE\b", r"\bKONA\b",
    r"\bDUSTER\b", r"\bOROCH\b", r"\bKARDIAN\b", r"\bCAPTUR\b", r"\bKOLEOS\b", r"\bKANGOO\b",
    r"\bKICKS\b", r"\bFRONTIER\b", r"\bX-TRAIL\b", r"\bPATHFINDER\b", r"\bTERRANO\b", r"\bXTERRA\b", r"\bMURANO\b", r"\bARMADA\b",
    r"\bL200\b", r"\bPAJERO\b", r"\bOUTLANDER\b", r"\bASX\b", r"\bECLIPSE CROSS\b", r"\bAIRTREK\b",
    r"\bDEFENDER\b", r"\bDISCOVERY\b", r"\bRANGE ROVER\b", r"\bEVOQUE\b", r"\bFREELANDER\b", r"\bVELAR\b",
    r"\bCAYENNE\b", r"\bMACAN\b",
    r"\bQ2\b", r"\bQ3\b", r"\bQ5\b", r"\bQ7\b", r"\bQ8\b",
    r"\bX1\b", r"\bX2\b", r"\bX3\b", r"\bX4\b", r"\bX5\b", r"\bX6\b", r"\bX7\b",
    r"\bGLA\b", r"\bGLB\b", r"\bGLC\b", r"\bGLE\b", r"\bGLS\b", r"\bGLK\b", r"\bML\b", r"\bCLASSE G\b",
    r"\bTIGGO\b", r"\bHAVAL\b", r"\bSONG\b",
    r"\bSPORTAGE\b", r"\bSORENTO\b", r"\bMOHAVE\b", r"\bCARNIVAL\b", r"\bSOUL\b", r"\bNIRO\b", r"\bSTONIC\b",
    r"\bJIMNY\b", r"\bVITARA\b", r"\bSAMURAI\b", r"\bS-CROSS\b",
    r"\bFORESTER\b", r"\bOUTBACK\b", r"\bTRIBECA\b",
    r"\bXC40\b", r"\bXC60\b", r"\bXC70\b", r"\bXC90\b",
    r"\b2008\b", r"\b3008\b", r"\b5008\b", r"\bHOGGAR\b", r"\bPARTNER\b", r"\bBERLINGO\b", r"\bAIRCROSS\b", r"\bC4 CACTUS\b", r"\bBASALT\b",
    r"\bRAMPAGE\b", r"\bDAKOTA\b", r"\bJOURNEY\b", r"\bDURANGO\b",
    r"\bACTYON\b", r"\bKORANDO\b", r"\bKYRON\b", r"\bREXTON\b", r"\bMUSSO\b", r"\bSCORPIO\b",
    r"\bX60\b", r"\bT40\b", r"\bT50\b", r"\bT60\b", r"\bT80\b",
    r"\bF-PACE\b", r"\bE-PACE\b", r"\bLEVANTE\b", r"\bGRECALE\b", r"\bURUS\b", r"\bDBX\b", r"\bBENTAYGA\b", r"\bCULLINAN\b",
    r"\bESCALADE\b", r"\bXT5\b", r"\bNAVIGATOR\b", r"\bAVIATOR\b", r"\bMKC\b", r"\bMKX\b",
    r"\bTERIOS\b", r"\bFEROZA\b", r"\bNIVA\b", r"\bCX-3\b", r"\bCX-5\b", r"\bCX-7\b", r"\bCX-9\b", r"\bB2500\b", r"\bB2200\b",
    r"\bMDX\b", r"\bRDX\b", r"\bFX35\b", r"\bFX45\b", r"\bFX50\b", r"\bQX\d+\b", r"\bCOUNTRYMAN\b",
]
UTILITY_MODEL_REGEX = re.compile("|".join(UTILITY_MODEL_KEYWORDS), re.IGNORECASE)

TRUCK_MODEL_KEYWORDS = [
    r"\bCAMINH[AÃ]O\b", r"\bCAMI[AÃ]O\b", r"\bCONSTELLATION\b", r"\bDELIVERY\b", r"\bWORKER\b",
    r"\bACTROS\b", r"\bATEGO\b", r"\bACCELO\b", r"\bAXOR\b", r"\bSPRINTER\b", r"\bVITO\b",
    r"\bCARGO\b", r"\bF-?350\b", r"\bF-?4000\b", r"\bTRANSIT\b",
    r"\bDUCATO\b", r"\bSCUDO\b", r"\bMASTER\b", r"\bTRAFIC\b", r"\bDAILY\b",
    r"\bBOXER\b", r"\bEXPERT\b", r"\bJUMPER\b", r"\bJUMPY\b",
    r"\bBONGO\b", r"\bBESTA\b", r"\bPORTER\b", r"\bTOWNER\b", r"\bTOPIC\b", r"\bS[EÉ]RIE 20\b",
]
TRUCK_MODEL_REGEX = re.compile("|".join(TRUCK_MODEL_KEYWORDS), re.IGNORECASE)

PURE_BEV_KEYWORDS = re.compile(
    r"\b(E-TRON|EQA|EQB|EQC|EQE|EQS|EV\b|EV5|EV6|EV9|I3\b|I4\b|I5\b|I7\b|IX\b|IX1|IX2|IX3|EDRIVE|EDRV|"
    r"500E|ELEKTRO|ELECTRIC|MACH-E|TAYCAN|ID\.3|ID\.4|ID\.5|ID\.BUZZ|ZOE|TWIZY|MEGANE E-TECH|LEAF|ARIYA|"
    r"I-PACE|EX30|EX40|EX90|DOLPHIN|YUAN|SEAL|TAN)\b",
    re.IGNORECASE,
)

PLACEHOLDER_FILTER_REGEX = re.compile(
    r"(ELECTRIC\s*VEHICLE|LIFE-?TIME|LIFETIME|NO\s*FILTER|WITHOUT|N/A|NONE)",
    re.IGNORECASE,
)


def fix_mojibake(text: str) -> str:
    if not text:
        return ""
    s = str(text).strip()
    replacements = {
        "três volumes": "Sedan",
        "Três volumes": "Sedan",
        "trs volumes": "Sedan",
        "Trs volumes": "Sedan",
        "Veículo multiuso": "",
        "Veculo multiuso": "",
        "Veículo todo-terreno fechado": "",
        "Veculo todo-terreno fechado": "",
        "Veículo todo-terreno aberto": "",
        "Veculo todo-terreno aberto": "",
        "Srie": "Série",
        "Carroçaria/Combi": "Furgão",
        "Carroaria/Combi": "Furgão",
        "Camião de plataforma/chassi": "Chassi",
        "Camio de plataforma/chassi": "Chassi",
        "Tracção integral": "4x4",
        "Traco integral": "4x4",
        "SANTA FÉ": "Santa Fé",
        "SANTA F": "Santa Fé",
        "Santa Fée": "Santa Fé",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s


def smart_title_case(text: str) -> str:
    words = text.split()
    out = []
    for w in words:
        clean_upper = w.upper().strip(",.;:")
        if clean_upper in UPPERCASE_TOKENS:
            out.append(clean_upper)
        elif re.match(r"^\d+(\.\d+)?[A-Za-z]{1,4}$", w):
            if clean_upper == "4X4":
                out.append("4x4")
            elif clean_upper == "4X2":
                out.append("4x2")
            else:
                out.append(clean_upper)
        elif "-" in w and len(w) <= 6 and any(c.isdigit() for c in w):
            out.append(w.upper())
        elif w.lower() in {"de", "do", "da", "dos", "das", "e", "a", "com", "para"} and out:
            out.append(w.lower())
        else:
            out.append(w.capitalize())
    return " ".join(out)


def sanitize_manufacturer(raw_manuf: str, filename_brand: str) -> str:
    key = (raw_manuf or filename_brand or "").strip().upper()
    if key in MANUFACTURER_MAP:
        return MANUFACTURER_MAP[key]
    f_key = (filename_brand or "").strip().upper()
    if f_key in MANUFACTURER_MAP:
        return MANUFACTURER_MAP[f_key]
    return key.replace("_", " ").title()


def sanitize_model(raw_model: str, manufacturer: str) -> tuple[str, str]:
    s = fix_mojibake(raw_model)
    raw_ctx = s

    s = re.sub(r"\([^)]*\)?", " ", s)

    body_replacements = [
        (r"\btr[eê]s volumes\b", "Sedan"),
        (r"\bHatchback\b", "Hatch"),
        (r"\bSportback\b", "Sportback"),
        (r"\bFastback\b", "Fastback"),
        (r"\bVe[ií]culo multiuso\b", ""),
        (r"\bVe[ií]culo todo-terreno fechado\b", ""),
        (r"\bVe[ií]culo todo-terreno aberto\b", ""),
        (r"\bCarro[cç]aria\s*/\s*Combi\b", "Furgão"),
        (r"\bCaixa\s*/\s*Combi\b", "Furgão"),
        (r"\bCami[aã]o de plataforma\s*/\s*chassi\b", "Chassi"),
        (r"\bCrew Cab Pickup\b", "Cabine Dupla"),
        (r"\bStandard Cab Pickup\b", "Cabine Simples"),
        (r"\bExtended Cab Pickup\b", "Cabine Estendida"),
        (r"\bCab & Chassis\b", "Chassi"),
        (r"\bMonospace\b", ""),
        (r"\b20 S[eé]rie Pick-up\b", "Série 20 Pick-up"),
        (r"\b10 S[eé]rie\b", "Série 10"),
        (r"\bHB20\s+HB20X\b", "HB20"),
        (r"\bSanta\s+F[eé]e\b", "Santa Fé"),
    ]
    for pat, rep in body_replacements:
        s = re.sub(pat, rep, s, flags=re.IGNORECASE)

    s = s.replace("/", " ")
    s = re.sub(r"\s+", " ", s).strip(" -_,")

    tokens = s.split()
    deduped = []
    seen_lower = set()
    for t in tokens:
        tl = t.lower()
        if tl in seen_lower and tl not in {"i", "ii", "iii", "iv", "v"}:
            continue
        seen_lower.add(tl)
        deduped.append(t)

    clean = smart_title_case(" ".join(deduped))
    if clean.lower().startswith(manufacturer.lower() + " "):
        clean = clean[len(manufacturer) + 1 :].strip()

    return (clean or "Modelo Padrão", raw_ctx)


def sanitize_version(raw_version: str) -> str:
    s = fix_mojibake(raw_version)
    s = re.sub(r"<[^>]+>", " ", s)

    def _clean_paren(match):
        inner = match.group(1).strip() if match.group(1) else ""
        if re.search(r"\b(flex|turbo|diesel|hybrid|h[ií]brido|gnv|etanol|gasolina|4x4|bi-?turbo)\b", inner, re.I):
            return f"({inner})"
        return " "

    s = re.sub(r"\(([^)]*)\)?", _clean_paren, s)

    ver_replacements = [
        (r"\bCONFORTLINE\b", "Comfortline"),
        (r"\bFlexfuel\b", "Flex"),
        (r"\bE100\s+Flex\b", "Flex"),
        (r"\bE100\b", "Flex"),
        (r"\bTrac[cç]?[aã]o integral\b", "4x4"),
        (r"\bAll-wheel drive\b", "AWD"),
        (r"\b4-motion\b", "4Motion"),
    ]
    for pat, rep in ver_replacements:
        s = re.sub(pat, rep, s, flags=re.IGNORECASE)

    s = re.sub(r"\s+", " ", s).strip(" -_,")
    clean = smart_title_case(s)
    return clean or "Motorização Padrão"


def parse_year_range(yoc_raw: str) -> tuple[int, int]:
    if not yoc_raw:
        return (2015, 2026)
    s = str(yoc_raw).strip()
    parts = [p.strip() for p in s.split("-")]

    def _to_year(part: str, default_yr: int) -> int:
        m = re.search(r"\.(\d{2})\b", part)
        if m:
            yy = int(m.group(1))
            return (1900 + yy) if yy > 30 else (2000 + yy)
        m4 = re.search(r"\b(19\d{2}|20\d{2})\b", part)
        if m4:
            return int(m4.group(1))
        return default_yr

    start_yr = _to_year(parts[0], 2015)
    if len(parts) > 1 and parts[1]:
        end_yr = _to_year(parts[1], 2026)
    else:
        end_yr = 2026

    if end_yr < start_yr:
        start_yr, end_yr = end_yr, start_yr

    start_yr = max(1960, min(2026, start_yr))
    end_yr = max(start_yr, min(2026, end_yr))
    return (start_yr, end_yr)


def is_pure_bev(manufacturer: str, model: str, version: str, cyl_cc, has_ev_placeholder: bool) -> bool:
    combined = f"{manufacturer} {model} {version}".upper()
    has_cc = False
    try:
        has_cc = int(float(str(cyl_cc).strip())) > 0
    except (ValueError, TypeError):
        has_cc = False

    if not has_cc and has_ev_placeholder:
        return True
    if not has_cc and PURE_BEV_KEYWORDS.search(combined) and not re.search(r"\b(HYBRID|PHEV|HEV|DM-I|TFSI|TSI|TDI)\b", combined):
        return True
    if re.search(r"\b(500E|ID\.4|E-TRON|EQA|EQB|EQC|EQE|EQS|TAYCAN|MUSTANG MACH-E|IONIQ 5|EV5|EV6|EV9|ZOE|TWIZY|MEGANE E-TECH|I-PACE)\b", combined):
        return True
    return False


def is_diesel_vehicle(manufacturer: str, model: str, version: str, raw_ctx: str) -> bool:
    combined = f"{manufacturer} {model} {version} {raw_ctx}".upper()
    if re.search(
        r"\b(DIESEL|TURBODIESEL|TDI|BITDI|SDI|CDI|CRD|JTD|JTDM|MULTIJET|HDI|BLUEHDI|TD350|TD270|"
        r"CDTI|CTDI|DID|DI-D|D-4D|D4D|TCI|CRDI|TDCI|ECOBLUE|DCI|TD4|SD4|TDV6|SDV6|OM651|OM654|"
        r"OM924|F1A|F1C|CUMMINS|DURAMAX|POWERSTROKE|MWM|MAXION)\b",
        combined,
    ):
        return True
    # Match patterns like "2.0 D", "2.2 D", "3.0 D", "3.7 D", "2.5 TD" when not followed by "ual" (Dual VVT-i) or "irect" or "ynamic"
    if re.search(r"\b\d\.\d\s*(?:D|TD|TDI|SD)\b(?!\s*(?:UAL|IRECT|YNAMIC|OHC|SG))", combined):
        return True
    # Models that are exclusively diesel in Brazil
    if re.search(r"\b(AMAROK|MASTER|DUCATO|SCUDO|SPRINTER|ACCELO|ATEGO|ACTROS|AXOR|DAILY|DELIVERY|CONSTELLATION|BONGO|TITANO|BANDEIRANTE|DEFENDER|JUMPY|EXPERT|BOXER|JUMPER)\b", combined):
        if not re.search(r"\b(FLEX|GASOLINA|ALCOOL|[AÁ]LCOOL|HYBRID|V6\s+GAS)\b", combined):
            return True
    return False


def classify_vehicle_type(manufacturer: str, model: str, version: str, raw_ctx: str) -> str:
    model_ctx = f"{model} {raw_ctx}".upper()
    full_ctx = f"{manufacturer} {model} {version} {raw_ctx}".upper()

    if TRUCK_MODEL_REGEX.search(model_ctx):
        return "CAMINHAO"
    if manufacturer == "Hyundai" and re.search(r"\bHR\b", model.upper()):
        return "CAMINHAO"
    if UTILITY_MODEL_REGEX.search(model_ctx):
        return "UTILITARIO"
    if manufacturer == "Lexus" and re.search(r"\b(UX|NX|RX|LX|GX)\b", model.upper()):
        return "UTILITARIO"
    if manufacturer == "Subaru" and re.search(r"\bXV\b", model.upper()):
        return "UTILITARIO"
    if manufacturer in {"Ram", "Dodge"} and re.search(r"\b(1500|2500|3500)\b", model.upper()):
        return "UTILITARIO"
    return "CARRO"


def estimate_sump_liters(cyl_cc_raw, vtype: str, is_diesel: bool) -> float:
    try:
        cc = int(float(str(cyl_cc_raw).strip()))
    except (ValueError, TypeError):
        return 6.5 if (is_diesel and vtype in {"UTILITARIO", "CAMINHAO"}) else 4.0
    if vtype == "MOTO":
        return 1.0 if cc <= 200 else (1.5 if cc <= 400 else 2.8)
    if vtype == "CAMINHAO":
        return 7.5 if cc <= 2500 else (9.5 if cc <= 3800 else 16.0)
    if cc <= 1050:
        return 3.5
    if cc <= 1450:
        return 4.0
    if cc <= 1650:
        return 4.2
    if cc <= 2050:
        return 4.5 if not is_diesel else 4.8
    if cc <= 2550:
        return 5.3 if not is_diesel else 6.4
    if cc <= 3250:
        return 6.2 if not is_diesel else 7.5
    return 6.8 if not is_diesel else 8.5


OEM_NORM_COMPATIBILITY = {
    "Volkswagen": ["VW", "502", "504", "505", "507", "508", "509"],
    "Audi": ["VW", "AUDI", "502", "504", "505", "507", "508", "509"],
    "Seat": ["VW", "502", "504", "505", "507"],
    "Porsche": ["PORSCHE", "A40", "C30", "C20", "C40"],
    "Fiat": ["FIAT", "9.55535"],
    "Jeep": ["FIAT", "9.55535", "CHRYSLER", "MS-"],
    "Alfa Romeo": ["FIAT", "9.55535"],
    "Abarth": ["FIAT", "9.55535"],
    "Dodge": ["CHRYSLER", "MS-", "FIAT", "9.55535"],
    "Chrysler": ["CHRYSLER", "MS-"],
    "Ram": ["CHRYSLER", "MS-", "CES", "CUMMINS", "FIAT"],
    "Chevrolet": ["DEXOS", "GM", "OV 040"],
    "GMC": ["DEXOS", "GM"],
    "Cadillac": ["DEXOS", "GM"],
    "Opel": ["DEXOS", "GM", "OV 040"],
    "Ford": ["WSS-M2C", "FORD"],
    "Lincoln": ["WSS-M2C", "FORD"],
    "Land Rover": ["STJLR", "WSS-M2C", "JAGUAR"],
    "Jaguar": ["STJLR", "WSS-M2C", "JAGUAR"],
    "Renault": ["RENAULT", "RN0", "RN17"],
    "Peugeot": ["PSA", "B71"],
    "Citroën": ["PSA", "B71"],
    "DS": ["PSA", "B71"],
    "Mercedes-Benz": ["MB", "229.", "226.", "228."],
    "Smart": ["MB", "229."],
    "BMW": ["BMW", "LONGLIFE", "LL-"],
    "Mini": ["BMW", "LONGLIFE", "LL-"],
    "Alpina": ["BMW", "LONGLIFE", "LL-"],
    "Volvo": ["VOLVO", "VCC"],
}


def is_oem_norm_compatible(manufacturer: str, norm_str: str, is_diesel: bool) -> bool:
    if not norm_str:
        return False
    allowed = OEM_NORM_COMPATIBILITY.get(manufacturer)
    if not allowed:
        return False
    up = norm_str.upper()
    # Avoid assigning VW 507.00 / Fiat DS1 diesel norms to gasoline/flex engines
    if not is_diesel and any(d_norm in up for d_norm in ["507.00", "505.01", "DS1", "DS2", "RN0720", "228.31", "228.51"]):
        return False
    return any(tok in up for tok in allowed)


def extract_sae_viscosity(row_dict: dict) -> str | None:
    for k, val in row_dict.items():
        if not val:
            continue
        kl = k.lower()
        if "viscosidade" in kl or "especifica" in kl:
            m = re.search(r"\b(\d{1,2}W-\d{2})\b", str(val).upper())
            if m:
                return m.group(1)
    term = str(row_dict.get("articleGenArtTerm") or "")
    m = re.search(r"\b(\d{1,2}W-\d{2})\b", term.upper())
    if m:
        return m.group(1)
    return None


def select_motor_oil_key(
    manufacturer: str,
    model: str,
    version: str,
    start_yr: int,
    end_yr: int,
    vtype: str,
    visc_counter: Counter,
    is_diesel: bool,
) -> tuple[str, str]:
    ver_up = f"{model} {version}".upper()
    dom_visc = visc_counter.most_common(1)[0][0] if visc_counter else None

    # 1. Motorcycles
    if vtype == "MOTO":
        if manufacturer == "Honda":
            return ("oil_moto_10w30_ma2", "10W-30")
        if end_yr <= 2010:
            return ("oil_moto_20w50_ma2", "20W-50")
        return ("oil_moto_10w40_ma2", "10W-40")

    # 2. Diesel Engines (Light, Pickup/SUV, Van, Heavy Truck)
    if is_diesel:
        if (
            end_yr <= 2011
            or re.search(r"\b(CUMMINS|OM924|OM926|MWM|MAXION|BANDEIRANTE|F-?1000|F-?250|F-?4000|D20|DELIVERY|CONSTELLATION|ACCELO|ATEGO|ACTROS|AXOR|CARGO)\b", ver_up)
        ):
            return ("oil_15w40_ck4_hd", "15W-40")
        if manufacturer in {"Fiat", "Jeep", "Ram", "Peugeot", "Citroën"} and start_yr >= 2022 and re.search(r"\b(BLUEHDI|2\.2)\b", ver_up):
            return ("oil_0w30_c2_fiat", "0W-30")
        return ("oil_5w30_diesel_dpf", "5W-30")

    # 3. Classic / Vintage Combustion Engines (always checked BEFORE brand fallbacks!)
    if end_yr <= 1998 or re.search(
        r"\b(OPALA|CARAVAN|CHEVETTE|MONZA|KADETT|IPANEMA|A\s*10|A\s*20|C\s*10|C\s*20|VERANEIO|BONANZA|"
        r"FUSCA|BRASILIA|VARIANT I|VARIANT II|SP-1|SP-2|KARMANN|GOL G1|GOL G2|SAVEIRO G1|SAVEIRO G2|PARATI I|PARATI II|"
        r"BELINA|DEL REY|CORCEL|PAMPA|RURAL|GALAXIE|VERONA|APOLLO|LOGUS|POINTER|ESCORT III|ESCORT IV|ESCORT V|"
        r"147|SPAZIO|OGGI|PANORAMA|ELBA|PREMIO|TEMPRA|MILLE 19|UNO 1\.5|UNO 1\.6)\b",
        ver_up,
    ):
        return ("oil_15w40_sl", "15W-40")

    if end_yr <= 2005 and not re.search(r"\b(TURBO|TSI|TFSI|KOMPRESSOR|V6|V8|AMG|PORCHE|BMW)\b", ver_up):
        if manufacturer in {"Volkswagen", "Audi", "Seat"}:
            return ("oil_5w40_vw", "5W-40")
        return ("oil_10w40_semi", "10W-40")

    # 4. Brand & Engine-Specific Modern Rules
    if manufacturer in {"Volkswagen", "Audi", "Seat"}:
        if start_yr >= 2023 and dom_visc == "0W-20":
            return ("oil_0w20_vw508", "0W-20")
        if manufacturer == "Audi" and start_yr >= 2018 and dom_visc in {"0W-30", "5W-30"}:
            return ("oil_0w30_c3_euro", "0W-30")
        return ("oil_5w40_vw", "5W-40")

    if manufacturer == "Porsche":
        return ("oil_0w40_a3b4", "0W-40")

    if manufacturer in {"Chevrolet", "GMC", "Cadillac", "Opel"}:
        # Wet-belt CSS Prime 3-cylinder engines (Onix/Onix Plus 2019+, Tracker 1.0/1.2 2020+, Montana 1.2 2023+)
        if (
            re.search(r"\b(ONIX|TRACKER|MONTANA)\b", ver_up)
            and start_yr >= 2019
            and not re.search(r"\b(JOY|SPE|1\.4|1\.8|2\.0)\b", ver_up)
        ):
            if "TURBO" in ver_up or "1.2" in ver_up or "PLUS" in ver_up or start_yr >= 2020:
                return ("oil_5w30_dexos_belt", "5W-30")
        if start_yr >= 2017 and dom_visc == "0W-20":
            return ("oil_0w20_dexos", "0W-20")
        if start_yr >= 2011:
            return ("oil_5w30_dexos", "5W-30")
        return ("oil_5w30_dexos", "5W-30")

    if manufacturer in {"Fiat", "Jeep", "Abarth", "Ram", "Alfa Romeo"}:
        if re.search(r"\b(T270|T200|GSE|1\.3 TURBO|1\.0 TURBO|HURRICANE)\b", ver_up) or (
            re.search(r"\b(PULSE|FASTBACK)\b", ver_up) and "1.3" not in ver_up
        ):
            return ("oil_0w30_c2_fiat", "0W-30")
        if re.search(r"\b(FIREFLY|ARGO|CRONOS|PULSE 1\.3|STRADA 1\.3|FIORINO 1\.3|MOBI 1\.0 6V|TIGERSHARK|2\.4)\b", ver_up) or (
            start_yr >= 2017 and dom_visc == "0W-20"
        ):
            return ("oil_0w20_fiat_dsx", "0W-20")
        if start_yr >= 2010 or re.search(r"\b(ETORQ|E\.TORQ|EVO|1\.6 16V|1\.8 16V|MOBI|TORO 1\.8|RENEGADE 1\.8)\b", ver_up):
            return ("oil_5w30_fiat_g1", "5W-30")
        return ("oil_10w40_semi", "10W-40")

    if manufacturer in {"Ford", "Lincoln"}:
        if start_yr >= 2014 or re.search(r"\b(KA III|KA\+|DRAGON|TI-VCT|ECOBOOST|SIGMA|BRONCO|MAVERICK|TERRITORY)\b", ver_up):
            return ("oil_5w20_ford", "5W-20")
        return ("oil_5w30_sp_gf6", "5W-30")

    if manufacturer in {"Toyota", "Lexus"}:
        if re.search(r"\b(HYBRID|DYNAMIC FORCE)\b", ver_up) and dom_visc == "0W-16":
            return ("oil_0w16_sp", "0W-16")
        if start_yr >= 2009:
            return ("oil_0w20_sp", "0W-20")
        return ("oil_5w30_sp_gf6", "5W-30")

    if manufacturer in {"Honda", "Acura"}:
        if start_yr >= 2012:
            return ("oil_0w20_sp", "0W-20")
        return ("oil_5w30_sp_gf6", "5W-30")

    if manufacturer in {"Hyundai", "Kia", "Genesis"}:
        if re.search(r"\b(TGDI|GDI|SMARTSTREAM|HYBRID|NIRO|STONIC)\b", ver_up) and start_yr >= 2019:
            return ("oil_0w20_sp", "0W-20")
        if start_yr >= 2008:
            return ("oil_5w30_sp_gf6", "5W-30")
        return ("oil_10w40_semi", "10W-40")

    if manufacturer == "Renault":
        if start_yr >= 2015 or re.search(r"\b(KWID|SCE|TCE|KARDIAN|CAPTUR|OROCH|DUSTER|SANDERO STEPWAY II|LOGAN STEPWAY II)\b", ver_up):
            return ("oil_5w30_rn17", "5W-30")
        if start_yr >= 2007:
            return ("oil_5w40_a3b4", "5W-40")
        return ("oil_10w40_semi", "10W-40")

    if manufacturer in {"Peugeot", "Citroën", "DS"}:
        if re.search(r"\b(T200|1\.0 TURBO)\b", ver_up):
            return ("oil_0w30_c2_fiat", "0W-30")
        if re.search(r"\b(FIREFLY|1\.0 6V|BASALT 1\.0)\b", ver_up):
            return ("oil_0w20_fiat_dsx", "0W-20")
        if start_yr >= 2011:
            return ("oil_5w30_c2_psa", "5W-30")
        return ("oil_10w40_semi", "10W-40")

    if manufacturer in {"BYD", "GWM Haval"}:
        return ("oil_0w20_sp", "0W-20")

    if manufacturer in {"Nissan", "Infiniti", "Mitsubishi", "Subaru", "Suzuki", "Mazda", "CAOA Chery", "JAC", "Lifan"}:
        if start_yr >= 2018 and dom_visc == "0W-20":
            return ("oil_0w20_sp", "0W-20")
        if start_yr >= 2007:
            return ("oil_5w30_sp_gf6", "5W-30")
        return ("oil_10w40_semi", "10W-40")

    if manufacturer in {"Volvo", "Land Rover", "Jaguar"}:
        if start_yr >= 2015:
            return ("oil_0w30_c3_euro", "0W-30")
        return ("oil_5w30_c3_euro", "5W-30")

    if manufacturer in {"BMW", "Mini", "Alpina", "Mercedes-Benz", "Smart"}:
        if dom_visc == "0W-40" or "AMG" in ver_up:
            return ("oil_0w40_a3b4", "0W-40")
        if dom_visc == "0W-30" and start_yr >= 2018:
            return ("oil_0w30_c3_euro", "0W-30")
        if start_yr >= 2007:
            return ("oil_5w30_c3_euro", "5W-30")
        return ("oil_5w40_a3b4", "5W-40")

    return ("oil_5w30_sp_gf6", "5W-30")


def select_transmission_key(
    manufacturer: str,
    model: str,
    version: str,
    start_yr: int,
    end_yr: int,
    vtype: str,
    is_diesel: bool,
) -> tuple[str, float]:
    ver_up = f"{model} {version}".upper()

    # 1. Motorcycles
    if vtype == "MOTO":
        if re.search(r"\b(PCX|NMAX|ELITE|ADV|NEO|FLUO|SCOOTER|BURGMAN)\b", ver_up):
            return ("trans_mt_75w90", 0.2)
        return ("trans_mt_75w80", 1.0)

    # 2. Commercial Trucks & Vans
    if vtype == "CAMINHAO":
        if re.search(r"\b(HI-MATIC|AT|AUTOMATIC)\b", ver_up):
            return ("trans_atf_zf8", 7.0)
        if re.search(r"\b(MASTER|DUCATO|SCUDO|EXPERT|JUMPY|BOXER|JUMPER|TRANSIT)\b", ver_up):
            return ("trans_mt_75w80", 2.6)
        return ("trans_hd_80w90", 4.5)

    # 3. Dual-Clutch (DSG / S-Tronic / PDK / Powershift / EDC / DCT)
    if re.search(r"\b(DSG|S-TRONIC|STRONIC|PDK|DCT|POWERSHIFT|EDC)\b", ver_up):
        return ("trans_dct_dsg", 6.0)
    if manufacturer in {"Audi", "Porsche"} and start_yr >= 2010:
        return ("trans_dct_dsg", 6.0)
    if manufacturer == "Volkswagen" and re.search(r"\b(GOLF VII|GOLF VIII|JETTA.*2\.0 TSI|PASSAT B7|PASSAT B8|TIGUAN|ARTEON)\b", ver_up) and start_yr >= 2012:
        return ("trans_dct_dsg", 6.0)
    if manufacturer in {"BYD", "GWM Haval"} or (manufacturer == "CAOA Chery" and re.search(r"\b(TIGGO 5X PRO|TIGGO 7|TIGGO 8)\b", ver_up)):
        return ("trans_dct_dsg", 5.5)
    if re.search(r"\b(KARDIAN)\b", ver_up):
        return ("trans_dct_dsg", 5.0)

    # 4. CVT (ONLY true CVT models — NEVER Hilux, SW4, Frontier, L200, Pajero!)
    if re.search(r"\bCVT\b", ver_up):
        return ("trans_cvt", 5.5)
    if manufacturer == "Toyota" and re.search(r"\b(COROLLA|YARIS|PRIUS|RAV\s*4)\b", ver_up) and start_yr >= 2015:
        return ("trans_cvt", 5.5)
    if manufacturer == "Honda" and (
        re.search(r"\b(FIT|HR-V|WR-V|ZR-V)\b", ver_up)
        or (re.search(r"\b(CITY|CIVIC|CR-V|ACCORD)\b", ver_up) and start_yr >= 2016)
    ):
        return ("trans_cvt", 5.0)
    if manufacturer == "Nissan" and re.search(r"\b(KICKS|SENTRA|VERSA|ALTIMA)\b", ver_up) and start_yr >= 2014 and "1.0 TURBO" not in ver_up:
        return ("trans_cvt", 5.5)
    if manufacturer in {"Fiat", "Peugeot", "Citroën"} and re.search(r"\b(T200|1\.0 TURBO|PULSE|FASTBACK 1\.0|BASALT 1\.0)\b", ver_up):
        return ("trans_cvt", 5.5)
    if manufacturer == "Mitsubishi" and re.search(r"\b(ASX|LANCER|OUTLANDER|ECLIPSE CROSS)\b", ver_up) and start_yr >= 2012:
        return ("trans_cvt", 5.5)
    if manufacturer == "Subaru" and start_yr >= 2012:
        return ("trans_cvt", 6.0)
    if manufacturer == "CAOA Chery" and re.search(r"\b(ARRIZO|TIGGO 2|TIGGO 5X 1\.5)\b", ver_up):
        return ("trans_cvt", 5.5)

    # 5. ZF 8HP / 9HP (Amarok AT8, Toro/Compass/Renegade/Commander/Rampage Diesel/Hurricane AT9, BMW, Land Rover, Jaguar, Ram)
    if (
        (manufacturer in {"Fiat", "Jeep", "Ram"} and (is_diesel or "HURRICANE" in ver_up or "CHER" in ver_up) and start_yr >= 2014)
        or (manufacturer == "Volkswagen" and "AMAROK" in ver_up and start_yr >= 2012)
        or (manufacturer in {"BMW", "Land Rover", "Jaguar", "Ram", "Dodge", "Chrysler", "Alfa Romeo", "Maserati"} and start_yr >= 2012)
    ):
        return ("trans_atf_zf8", 6.5)

    # 6. Manual Transmissions (Classic cars, entry-level 1.0/1.3/1.4/1.5/1.6 cars without AT/Turbo)
    if end_yr <= 2011 and not re.search(r"\b(AT|AUT|AUTOMATIC|TIPTRONIC|V6|V8|V10|V12|CAMRY|ACCORD|AZERA|SONATA|FUSION|OMEGA|VERACRUZ|SANTA F|MOHAVE|SORENTO|CAYENNE|TOUAREG|X5|X3|ML|GLK|CLASSE C|CLASSE E|CLASSE S)\b", ver_up):
        return ("trans_mt_75w80", 2.2)

    if re.search(
        r"\b(GOL\b|VOYAGE|SAVEIRO|UP!|FOX|SPACEFOX|KOMBI|POLO TRACK|POLO.*MPI|"
        r"CELTA|CLASSIC|CORSA|AGILE|MONTANA 1\.4|PRISMA 1\.0|ONIX 1\.0|ONIX.*SPE|ONIX.*JOY|JOY\b|COBALT 1\.4|"
        r"MOBI|UNO|MILLE|PALIO|SIENA|GRAND SIENA|PUNTO 1\.4|PUNTO 1\.6|IDEA|DOBLO|FIORINO|STRADA 1\.4|STRADA 1\.3|ARGO 1\.0|ARGO 1\.3|CRONOS 1\.0|CRONOS 1\.3|"
        r"KWID|CLIO|SANDERO|LOGAN|KANGOO|SYMBOL|"
        r"KA\b|KA III|KA\+|FIESTA|COURIER|ESCORT|"
        r"HB20 1\.0|HB20S 1\.0|MARCH 1\.0|206|207|208 1\.0|208 1\.2|208 1\.5|C3 1\.0|C3 1\.2|C3 1\.4|C3 1\.5)\b",
        ver_up,
    ) and not re.search(r"\b(AT|AT6|AUT|AUTOMATIC|TURBO|TSI|TGDI|T200|T270|CVT|IMOTION|DUALOGIC|EASYTRONIC)\b", ver_up):
        return ("trans_mt_75w80", 2.0)

    # 7. Conventional 6-to-10 Speed Torque-Converter Automatic (Aisin AW-1 / Dexron VI / Toyota WS / Hyundai SP-IV)
    return ("trans_atf_aw1", 6.0)


CATALOG_BY_KEY = {c["key"]: c for c in CANONICAL_CATALOGS}


def select_filter_keys(
    manufacturer: str,
    model: str,
    version: str,
    start_yr: int,
    end_yr: int,
    vtype: str,
    is_diesel: bool,
    oil_refs_str: str = "",
) -> tuple[str, str, str]:
    """Return (oil_filter_key, fuel_filter_key, air_filter_key) for the given vehicle."""
    ver_up = f"{model} {version}".upper()
    refs_up = (oil_refs_str or "").upper()
    has_cartridge_ref = bool(re.search(r"\b(HU\s*\d|OX\s*\d|PEL\s*\d|E\d+H)\b", refs_up))

    # 1. Motorcycles
    if vtype == "MOTO":
        return ("fo_moto_4t", "fc_moto_4t", "fa_moto_4t")

    # 2. Heavy Trucks & Commercial Vans (CAMINHAO)
    if vtype == "CAMINHAO":
        if manufacturer in {"Fiat", "Iveco", "Peugeot", "Citroën"}:
            return ("fo_vans_ducato_daily_boxer", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        if manufacturer == "Renault":
            return ("fo_renault_master_dci", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        if manufacturer == "Ford" and "TRANSIT" in ver_up:
            return ("fo_ford_ranger_diesel", "fc_vans_caminhao_racor", "fa_ford_ranger_diesel")
        if manufacturer in {"Hyundai", "Kia"}:
            return ("fo_hyundai_kia_hr_bongo", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        if manufacturer == "Mercedes-Benz" and "SPRINTER" in ver_up:
            return ("fo_mb_sprinter_cdi", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        return ("fo_caminhao_pesado_diesel", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")

    # 3. Volkswagen / Seat
    if manufacturer in {"Volkswagen", "Seat"}:
        if is_diesel or "AMAROK" in ver_up:
            return ("fo_vw_amarok_tdi", "fc_picapes_diesel_sep", "fa_vw_amarok_tdi")
        if end_yr <= 1998 or (
            re.search(r"\b(FUSCA|KOMBI 1\.6|GOL G1|GOL G2|PARATI I|PARATI II|SAVEIRO G1|SAVEIRO G2|SANTANA|QUANTUM|AP\b|1\.8|2\.0)\b", ver_up)
            and start_yr <= 2008
            and "TSI" not in ver_up
        ):
            return ("fo_vw_ap", "fc_vw_flex", "fa_vw_ap")
        if re.search(r"\b(2\.0 TSI|350 TSI|GOLF GTI|JETTA GLI|TIGUAN|PASSAT|EOS|SCIROCCO|TOUAREG|ARTEON)\b", ver_up) or has_cartridge_ref:
            return ("fo_vw_tsi_ea888", "fc_vw_flex", "fa_vw_tsi_ea888")
        return ("fo_vw_ea111_ea211", "fc_vw_flex", "fa_vw_ea111_ea211")

    # 4. Chevrolet / GMC / Cadillac / Opel
    if manufacturer in {"Chevrolet", "GMC", "Cadillac", "Opel"}:
        if is_diesel or re.search(r"\b(S10|TRAILBLAZER|SILVERADO|D20)\b", ver_up):
            return ("fo_gm_s10_diesel", "fc_picapes_diesel_sep", "fa_gm_s10_diesel")
        if re.search(r"\b(CRUZE|SONIC|TRACKER 1\.8|TRACKER 1\.4|EQUINOX|MALIBU|CAPTIVA|CAMARO)\b", ver_up) or has_cartridge_ref:
            return ("fo_gm_cruze_ecotec", "fc_gm_flex", "fa_gm_css_prime")
        if (
            re.search(r"\b(ONIX|TRACKER|MONTANA)\b", ver_up)
            and start_yr >= 2019
            and not re.search(r"\b(JOY|SPE|1\.4)\b", ver_up)
        ):
            return ("fo_gm_css_prime", "fc_gm_flex", "fa_gm_css_prime")
        return ("fo_gm_familia_spe4", "fc_gm_flex", "fa_gm_familia_spe4")

    # 5. Fiat / Jeep / Ram / Dodge / Chrysler / Alfa Romeo / Abarth
    if manufacturer in {"Fiat", "Jeep", "Ram", "Dodge", "Chrysler", "Alfa Romeo", "Abarth"}:
        if is_diesel:
            return ("fo_stellantis_multijet_diesel", "fc_stellantis_multijet_diesel", "fa_stellantis_gse_turbo")
        if re.search(r"\b(DUCATO|SCUDO)\b", ver_up):
            return ("fo_vans_ducato_daily_boxer", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        if re.search(r"\b(T270|T200|GSE|1\.3 TURBO|1\.0 TURBO|HURRICANE|COMPASS|COMMANDER|RAMPAGE)\b", ver_up):
            return ("fo_stellantis_gse_turbo", "fc_fiat_flex", "fa_stellantis_gse_turbo")
        if re.search(r"\b(ETORQ|E\.TORQ|1\.6 16V|1\.8 16V|TORO 1\.8|RENEGADE 1\.8|BRAVO|LINEA)\b", ver_up) or has_cartridge_ref:
            fa_key = "fa_stellantis_gse_turbo" if re.search(r"\b(TORO|RENEGADE)\b", ver_up) else "fa_fiat_fire_firefly"
            return ("fo_stellantis_etorq", "fc_fiat_flex", fa_key)
        return ("fo_fiat_fire_firefly", "fc_fiat_flex", "fa_fiat_fire_firefly")

    # 6. Ford / Lincoln
    if manufacturer in {"Ford", "Lincoln"}:
        if is_diesel or re.search(r"\b(RANGER|TRANSIT|F-?250|F-?1000|F-?4000|MAVERICK|BRONCO)\b", ver_up):
            fc_key = "fc_picapes_diesel_sep" if is_diesel else "fc_ford_flex"
            return ("fo_ford_ranger_diesel", fc_key, "fa_ford_ranger_diesel")
        return ("fo_ford_passeio", "fc_ford_flex", "fa_ford_passeio")

    # 7. Toyota / Lexus
    if manufacturer in {"Toyota", "Lexus"}:
        if is_diesel or re.search(r"\b(HILUX|SW4|BANDEIRANTE|LAND CRUISER|PRADO)\b", ver_up):
            fc_key = "fc_picapes_diesel_sep" if is_diesel else "fc_asiaticos_flex"
            return ("fo_toyota_hilux_diesel", fc_key, "fa_toyota_hilux_diesel")
        return ("fo_toyota_passeio", "fc_asiaticos_flex", "fa_toyota_passeio")

    # 8. Honda / Acura
    if manufacturer in {"Honda", "Acura"}:
        return ("fo_honda_ivtec", "fc_asiaticos_flex", "fa_honda_ivtec")

    # 9. Hyundai / Kia / Genesis
    if manufacturer in {"Hyundai", "Kia", "Genesis"}:
        if is_diesel:
            return ("fo_hyundai_kia_hr_bongo", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        return ("fo_hyundai_kia_passeio", "fc_asiaticos_flex", "fa_hyundai_kia_passeio")

    # 10. Renault
    if manufacturer == "Renault":
        if is_diesel or "MASTER" in ver_up:
            return ("fo_renault_master_dci", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        return ("fo_renault_passeio", "fc_renault_psa_flex", "fa_renault_passeio")

    # 11. Nissan / Infiniti
    if manufacturer in {"Nissan", "Infiniti"}:
        if is_diesel or "FRONTIER" in ver_up:
            return ("fo_nissan_frontier_diesel", "fc_picapes_diesel_sep", "fa_mitsubishi_picapes_suv")
        return ("fo_nissan_passeio", "fc_asiaticos_flex", "fa_nissan_passeio")

    # 12. Peugeot / Citroën / DS
    if manufacturer in {"Peugeot", "Citroën", "DS"}:
        if is_diesel or re.search(r"\b(EXPERT|JUMPY|BOXER|JUMPER)\b", ver_up):
            return ("fo_vans_ducato_daily_boxer", "fc_vans_caminhao_racor", "fa_vans_caminhao_diesel")
        if re.search(r"\b(T200|1\.0 TURBO)\b", ver_up):
            return ("fo_stellantis_gse_turbo", "fc_renault_psa_flex", "fa_stellantis_gse_turbo")
        if re.search(r"\b(FIREFLY|1\.0 6V|BASALT 1\.0)\b", ver_up):
            return ("fo_fiat_fire_firefly", "fc_renault_psa_flex", "fa_fiat_fire_firefly")
        return ("fo_psa_passeio", "fc_renault_psa_flex", "fa_psa_passeio")

    # 13. Mitsubishi / Suzuki / Subaru / Mazda
    if manufacturer in {"Mitsubishi", "Suzuki", "Subaru", "Mazda"}:
        if is_diesel or re.search(r"\b(L200|PAJERO)\b", ver_up):
            fc_key = "fc_picapes_diesel_sep" if is_diesel else "fc_asiaticos_flex"
            return ("fo_mitsubishi_triton_diesel", fc_key, "fa_mitsubishi_picapes_suv")
        return ("fo_mitsubishi_passeio", "fc_asiaticos_flex", "fa_mitsubishi_picapes_suv")

    # 14. CAOA Chery / BYD / GWM Haval / JAC / Lifan
    if manufacturer in {"CAOA Chery", "BYD", "GWM Haval", "JAC", "Lifan"}:
        return ("fo_chery_byd_gwm", "fc_asiaticos_flex", "fa_chery_byd_gwm")

    # 15. European Premium (BMW, Mercedes-Benz, Audi, Volvo, Land Rover, Jaguar, Porsche, Mini)
    if is_diesel:
        return ("fo_euro_premium_cartucho", "fc_picapes_diesel_sep", "fa_euro_premium")
    return ("fo_euro_premium_cartucho", "fc_euro_alta_pressao", "fa_euro_premium")


def format_cross_refs(ref_counter: Counter, max_items: int = 3) -> str:
    if not ref_counter:
        return ""
    top = [item for item, _ in ref_counter.most_common(max_items)]
    return " • ".join(top)


def run_pipeline():
    raw_dir = Path(TECDOC_DIR)
    subdirs = [
        ("OLEO", "Motor_Oil"),
        ("FILTRO_OLEO", "Oil_Filter"),
        ("FILTRO_COMBUSTIVEL", "Fuel_Filter"),
        ("FILTRO_AR", "Air_Filter"),
    ]

    print(f"[1/5] Reading TecDoc Excel workbooks from {raw_dir}...")
    vehicle_groups = {}
    skipped_placeholder_refs = 0

    for sub_name, cat_raw in subdirs:
        sub_path = raw_dir / sub_name
        if not sub_path.exists():
            continue
        xlsx_files = sorted(sub_path.glob("*.xlsx"))
        print(f"      -> Scanning {sub_name} ({len(xlsx_files)} files)...")
        for fp in xlsx_files:
            try:
                wb = openpyxl.load_workbook(fp, read_only=True, data_only=True)
            except Exception as exc:
                print(f"         [WARN] Skipping unreadable workbook {fp.name}: {exc}")
                continue
            ws = wb.active
            rows_iter = ws.iter_rows(values_only=True)
            try:
                headers = [str(h or "").strip() for h in next(rows_iter)]
            except StopIteration:
                wb.close()
                continue

            for raw_tuple in rows_iter:
                row = dict(zip(headers, raw_tuple))
                m_raw = str(row.get("vehicleManCode") or "").strip()
                mod_raw = str(row.get("vehicleModelTerm") or "").strip()
                ver_raw = str(row.get("vehicleTypeTerm") or "").strip()
                if not m_raw or not mod_raw:
                    continue
                yoc_raw = str(row.get("yoc") or "").strip()
                brand_raw = fix_mojibake(str(row.get("articleDataSupplier") or "")).strip()
                art_no = fix_mojibake(str(row.get("articleNo") or "")).strip()

                manufacturer = sanitize_manufacturer(m_raw, fp.stem)
                model, raw_ctx = sanitize_model(mod_raw, manufacturer)
                version = sanitize_version(ver_raw)
                start_yr, end_yr = parse_year_range(yoc_raw)

                vkey = (manufacturer, model, version, start_yr, end_yr)
                grp = vehicle_groups.get(vkey)
                if grp is None:
                    grp = {
                        "manufacturer": manufacturer,
                        "model": model,
                        "version": version,
                        "startYear": start_yr,
                        "endYear": end_yr,
                        "raw_ctx": raw_ctx,
                        "cyl_cc": row.get("cylinderCapacity"),
                        "power_cv": row.get("kwFrom"),
                        "visc": Counter(),
                        "oem_norms": Counter(),
                        "oil_filters": Counter(),
                        "fuel_filters": Counter(),
                        "air_filters": Counter(),
                        "has_ev_placeholder": False,
                    }
                    vehicle_groups[vkey] = grp

                if not grp["cyl_cc"] and row.get("cylinderCapacity"):
                    grp["cyl_cc"] = row.get("cylinderCapacity")

                ref_label = f"{brand_raw}: {art_no}".strip(": ")
                if "ELECTRIC VEHICLE" in ref_label.upper():
                    grp["has_ev_placeholder"] = True
                    skipped_placeholder_refs += 1
                    continue
                if PLACEHOLDER_FILTER_REGEX.search(ref_label):
                    skipped_placeholder_refs += 1
                    continue

                if cat_raw == "Motor_Oil":
                    v = extract_sae_viscosity(row)
                    if v:
                        grp["visc"][v] += 1
                    for col_k, col_v in row.items():
                        if not col_v:
                            continue
                        ck_low = col_k.lower()
                        if "aprova" in ck_low or "recomenda" in ck_low:
                            norm = fix_mojibake(str(col_v)).strip()
                            if norm and len(norm) <= 48 and is_oem_norm_compatible(manufacturer, norm, is_diesel_vehicle(manufacturer, model, version, raw_ctx)):
                                grp["oem_norms"][norm] += 1
                elif cat_raw == "Oil_Filter" and art_no:
                    grp["oil_filters"][ref_label] += 1
                elif cat_raw == "Fuel_Filter" and art_no:
                    grp["fuel_filters"][ref_label] += 1
                elif cat_raw == "Air_Filter" and art_no:
                    grp["air_filters"][ref_label] += 1
            wb.close()

    print(f"      -> Aggregated {len(vehicle_groups)} raw vehicle configurations (filtered {skipped_placeholder_refs} dummy/lifetime/EV filter rows).")

    # Remove pure BEVs (electric vehicles with no internal combustion engine)
    bev_keys = [
        k
        for k, g in vehicle_groups.items()
        if is_pure_bev(g["manufacturer"], g["model"], g["version"], g["cyl_cc"], g["has_ev_placeholder"])
    ]
    for k in bev_keys:
        del vehicle_groups[k]
    print(f"      -> Removed {len(bev_keys)} pure electric vehicles (BEVs without internal combustion engine).")

    # Build sibling model filter fallback index: (manufacturer, model) -> Counter of filter refs
    model_filter_fallback = defaultdict(lambda: {"oil": Counter(), "fuel": Counter(), "air": Counter()})
    for g in vehicle_groups.values():
        mkey = (g["manufacturer"], g["model"])
        model_filter_fallback[mkey]["oil"].update(g["oil_filters"])
        model_filter_fallback[mkey]["fuel"].update(g["fuel_filters"])
        model_filter_fallback[mkey]["air"].update(g["air_filters"])

    print("[2/5] Building sanitized vehicle records & OEM specifications...")
    vehicles_out = []
    seen_vehicle_signatures = set()
    sibling_inherited_count = 0

    for vkey in sorted(vehicle_groups.keys()):
        grp = vehicle_groups[vkey]
        m = grp["manufacturer"]
        mod = grp["model"]
        ver = grp["version"]
        sy = grp["startYear"]
        ey = grp["endYear"]
        rctx = grp["raw_ctx"]

        is_diesel = is_diesel_vehicle(m, mod, ver, rctx)
        vtype = classify_vehicle_type(m, mod, ver, rctx)
        sump_l = estimate_sump_liters(grp["cyl_cc"], vtype, is_diesel)

        oil_key, sae = select_motor_oil_key(m, mod, ver, sy, ey, vtype, grp["visc"], is_diesel)
        trans_key, trans_l = select_transmission_key(m, mod, ver, sy, ey, vtype, is_diesel)

        # Sibling inheritance for missing filter cross-references
        mkey = (m, mod)
        oil_refs_counter = grp["oil_filters"] or model_filter_fallback[mkey]["oil"]
        fuel_refs_counter = grp["fuel_filters"] or model_filter_fallback[mkey]["fuel"]
        air_refs_counter = grp["air_filters"] or model_filter_fallback[mkey]["air"]
        if not grp["oil_filters"] and oil_refs_counter:
            sibling_inherited_count += 1

        oil_refs = format_cross_refs(oil_refs_counter)
        fuel_refs = format_cross_refs(fuel_refs_counter)
        air_refs = format_cross_refs(air_refs_counter)

        fo_key, fc_key, fa_key = select_filter_keys(m, mod, ver, sy, ey, vtype, is_diesel, oil_refs)

        # Brake fluid selection
        if sy >= 2016 or m in {"Volkswagen", "Audi", "BMW", "Mercedes-Benz", "Porsche", "Volvo", "Land Rover", "Jeep"}:
            bf_key = "brake_dot4_lv"
        else:
            bf_key = "brake_dot4"

        top_norm = grp["oem_norms"].most_common(1)[0][0] if grp["oem_norms"] else ""
        oil_note = f"TecDoc SAE {sae}" + (f" • Norma {top_norm}" if top_norm else f" • {CATALOG_BY_KEY[oil_key]['specification']}")
        fo_note = f"Ref. TecDoc Homologada: {oil_refs}" if oil_refs else f"Ref. Homologada: {CATALOG_BY_KEY[fo_key]['specification']}"
        fc_note = f"Ref. TecDoc Homologada: {fuel_refs}" if fuel_refs else f"Ref. Homologada: {CATALOG_BY_KEY[fc_key]['specification']}"
        fa_note = f"Ref. TecDoc Homologada: {air_refs}" if air_refs else f"Ref. Homologada: {CATALOG_BY_KEY[fa_key]['specification']}"

        sig = (m.upper(), mod.upper(), ver.upper(), sy, ey)
        seen_vehicle_signatures.add(sig)
        vehicles_out.append(
            {
                "manufacturer": m,
                "model": mod,
                "version": ver,
                "type": vtype,
                "manufYearStart": sy,
                "manufYearEnd": ey,
                "sumpLiters": round(sump_l, 1),
                "transLiters": round(trans_l, 1),
                "oilKey": oil_key,
                "oilNotes": oil_note,
                "brakeKey": bf_key,
                "transKey": trans_key,
                "foKey": fo_key,
                "foNotes": fo_note,
                "fcKey": fc_key,
                "fcNotes": fc_note,
                "faKey": fa_key,
                "faNotes": fa_note,
            }
        )

    print(f"      -> Inherited sibling filter references for {sibling_inherited_count} vehicles.")

    # [3/5] Merge Curated Popular Brazilian Fleet (CARRO, UTILITARIO, CAMINHAO, MOTO)
    print(f"[3/5] Merging {len(CURATED_BRAZILIAN_FLEET)} curated high-turnover Brazilian fleet vehicles...")
    added_curated = 0
    for c_item in CURATED_BRAZILIAN_FLEET:
        m = c_item["manufacturer"]
        mod = c_item["model"]
        ver = c_item["version"]
        sy = c_item["manufYearStart"]
        ey = c_item["manufYearEnd"]
        sig = (m.upper(), mod.upper(), ver.upper(), sy, ey)
        if sig in seen_vehicle_signatures:
            continue
        seen_vehicle_signatures.add(sig)
        added_curated += 1
        vehicles_out.append(dict(c_item))

    print(f"      -> Added {added_curated} curated popular Brazilian vehicles.")

    # Sort vehicles cleanly by manufacturer, model, version, manufYearStart
    vehicles_out.sort(key=lambda v: (v["manufacturer"], v["model"], v["version"], v["manufYearStart"]))

    type_counts = Counter(v["type"] for v in vehicles_out)
    print(f"      -> Final Fleet Breakdown: {dict(type_counts)} (Total: {len(vehicles_out)} vehicles)")

    out_payload = {
        "generatedAt": "2026-10-25T20:15:00Z",
        "totalVehicles": len(vehicles_out),
        "totalCatalogs": len(CANONICAL_CATALOGS),
        "catalogs": CANONICAL_CATALOGS,
        "vehicles": vehicles_out,
    }

    json_out_path = Path(r"C:\Users\thiag\Desktop\Engine\0.Desenvolvimento\apps\api\src\infra\database\tecdoc-sanitized.json")
    json_out_path.parent.mkdir(parents=True, exist_ok=True)
    with json_out_path.open("w", encoding="utf-8") as f:
        json.dump(out_payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[4/5] Saved JSON dataset to {json_out_path} ({json_out_path.stat().st_size / 1024:.1f} KB)")

    sql_out_path = Path(r"C:\Users\thiag\Desktop\Engine\0.Desenvolvimento\infra\database\seeds\003_seed_tecdoc_national_fleet.sql")
    sql_out_path.parent.mkdir(parents=True, exist_ok=True)
    write_sql_seed(sql_out_path, out_payload)
    print(f"[5/5] Saved PostgreSQL seed to {sql_out_path} ({sql_out_path.stat().st_size / 1024:.1f} KB)")


def sql_str(val) -> str:
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def write_sql_seed(sql_path: Path, payload: dict):
    lines = [
        "-- ============================================================================",
        "-- SOIL - Seed 003: Frota Nacional Homologada TecDoc + Curadoria Brasil",
        f"-- Gerado automaticamente por scripts/sanitize-tecdoc.py ({payload['totalVehicles']} veículos, {payload['totalCatalogs']} catálogos)",
        "-- Compatível com infra/database/migrations/001_initial_schema.sql (MySQL 8 / InnoDB)",
        "-- ============================================================================",
        "SET NAMES utf8mb4;",
        "USE soil;",
        "START TRANSACTION;",
        "",
        "-- 1. Catálogo Canônico de Fluidos e Filtros Homologados (tabela `catalog`)",
    ]

    catalog_id_by_key = {}
    for idx, c in enumerate(payload["catalogs"], start=1):
        catalog_id_by_key[c["key"]] = idx
        lines.append(
            f"INSERT INTO catalog (id, name, category, type, specification) "
            f"VALUES ({idx}, {sql_str(c['name'])}, {sql_str(c['category'])}, {sql_str(c['subtype'])}, {sql_str(c['specification'])}) "
            f"ON DUPLICATE KEY UPDATE name = VALUES(name), specification = VALUES(specification);"
        )

    lines.append("")
    lines.append("-- 2. Frota Nacional Sanitizada (tabela `vehicle`: CARRO, UTILITARIO, CAMINHAO, MOTO)")

    for v_idx, v in enumerate(payload["vehicles"], start=1):
        lines.append(
            f"INSERT INTO vehicle (id, manufacturer, model, version, type, manuf_year_start, manuf_year_end) "
            f"VALUES ({v_idx}, {sql_str(v['manufacturer'])}, {sql_str(v['model'])}, {sql_str(v['version'])}, {sql_str(v['type'])}, {v['manufYearStart']}, {v['manufYearEnd']}) "
            f"ON DUPLICATE KEY UPDATE version = VALUES(version), type = VALUES(type);"
        )

    lines.append("")
    lines.append("-- 3. Especificações Técnicas por Veículo (tabela `technical_specification` - 6 itens obrigatórios por veículo)")

    for v_idx, v in enumerate(payload["vehicles"], start=1):
        oil_id = catalog_id_by_key[v["oilKey"]]
        brake_id = catalog_id_by_key[v["brakeKey"]]
        trans_id = catalog_id_by_key[v["transKey"]]
        fo_id = catalog_id_by_key[v["foKey"]]
        fc_id = catalog_id_by_key[v["fcKey"]]
        fa_id = catalog_id_by_key[v["faKey"]]

        specs = [
            (oil_id, v["sumpLiters"], 10000, v["oilNotes"]),
            (brake_id, 1.0, 20000, "Substituição recomendada a cada 24 meses ou 20.000 km"),
            (trans_id, v["transLiters"], 60000, "Inspeção e troca preventiva conforme severidade de uso"),
            (fo_id, "NULL", 10000, v["foNotes"]),
            (fc_id, "NULL", 10000, v["fcNotes"]),
            (fa_id, "NULL", 15000, v["faNotes"]),
        ]
        for cat_id, cap_l, int_km, note_txt in specs:
            lines.append(
                f"INSERT INTO technical_specification (vehicle_id, catalog_id, capacity_liters, interval_km, notes) "
                f"VALUES ({v_idx}, {cat_id}, {cap_l}, {int_km}, {sql_str(note_txt[:250])}) "
                f"ON DUPLICATE KEY UPDATE capacity_liters = VALUES(capacity_liters), interval_km = VALUES(interval_km), notes = VALUES(notes);"
            )

    lines.append("")
    lines.append("-- 4. Produtos Homologados nas 3 Faixas de Cotação (tabela `product` - Econômico, OEM Recomendado e Premium)")

    for idx, c in enumerate(payload["catalogs"], start=1):
        is_oil = c["category"] == "OLEO"
        eco_price = 4490 if is_oil else 3290
        best_price = 6490 if is_oil else 5490
        prem_price = 8990 if is_oil else 7890

        tiers = [
            (c.get("ecoName") or f"{c['name']} - Econômico", c.get("ecoBrand") or "Lubrax / Wega", f"{c.get('ecoSku', 'ECO')}-{idx}", eco_price, "FALSE"),
            (c.get("bestName") or f"{c['name']} - OEM Recomendado", c.get("bestBrand") or "Mobil / Mann-Filter", f"{c.get('bestSku', 'BEST')}-{idx}", best_price, "TRUE"),
            (c.get("premName") or f"{c['name']} - Alta Performance", c.get("premBrand") or "Motul / Mahle", f"{c.get('premSku', 'PREM')}-{idx}", prem_price, "FALSE"),
        ]
        for p_name, p_brand, p_sku, p_cents, is_best in tiers:
            lines.append(
                f"INSERT INTO product (company_id, user_id, catalog_id, name, manufacturer, sku, price_cents, is_best_quality, is_available) "
                f"VALUES (2, 2, {idx}, {sql_str(p_name[:150])}, {sql_str(p_brand[:80])}, {sql_str(p_sku[:60])}, {p_cents}, {is_best}, TRUE);"
            )

    lines.append("")
    lines.append("COMMIT;")
    with sql_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    run_pipeline()
