import { Repository } from 'typeorm';

import { InjectRepository } from '../lib/decorators/injection';
import { Controller, RequestMethod, HttpRequest, RequestMapping } from '../lib/decorators/server';

import { Account, AccountType } from '../entity/Account';

@Controller({
	path: ['/account'],
	authenticated: true
})
export class AccountController {
	@InjectRepository(Account) private accountRepo: Repository<Account>;

	@RequestMapping({
		path: '/',
		method: RequestMethod.GET
	})
	async getData(@HttpRequest() req): Promise<any> {
		// Get the account from the database
		const account: Account = await this.accountRepo.findOneOrFail(req.getAccount());

		// Check banishment
		if (account.type === AccountType.BANNED) {
			return Promise.reject({ message: 'Your account is banned' });
		}

		// Return the account details
		return Promise.resolve({ account });
	}
}
