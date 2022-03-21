import { Helper } from '../lib/decorators/injection';
import { MailService } from '../lib/MailService';

import { Account } from '../entity/Account';

import { SystemParams } from '../config';

@Helper()
export class MailerHelper {
	public sendWelcomeEmail(account: Account): void {
		// Send email
		const mailService: MailService = new MailService(
			account.email, `Welcome to ${SystemParams.app.name}`
		);
		mailService.send('welcome');
	}
}
