import { IMailService, SendEmailPayload } from '../../application/ports/IMailService.js';

export class FakeMailService implements IMailService {
  public readonly sentEmails: SendEmailPayload[] = [];

  public async sendEmail(payload: SendEmailPayload): Promise<void> {
    this.sentEmails.push(payload);
  }
}
