export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface IMailService {
  sendEmail(payload: SendEmailPayload): Promise<void>;
}
