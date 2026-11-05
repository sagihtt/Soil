import nodemailer, { Transporter } from 'nodemailer';
import { IMailService, SendEmailPayload } from '../../application/ports/IMailService.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class NodemailerSmtpService implements IMailService {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  public constructor(config: SmtpConfig) {
    this.fromAddress = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  public async sendEmail(payload: SendEmailPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  }
}
