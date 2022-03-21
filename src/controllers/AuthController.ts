import { Repository } from 'typeorm';

import { Inject, InjectRepository } from '../lib/decorators/injection';
import { Controller, RequestMapping, RequestMethod, HttpRequest } from '../lib/decorators/server';

import { Account, AccountType } from '../entity/Account';

import { AuthHelper } from '../helpers/AuthHelper';
import { UtilsHelper } from '../helpers/UtilsHelper';

@Controller({
	path: ['/auth'],
	authenticated: false
})
export class AuthController {
	@Inject() private authHelper: AuthHelper;
	@Inject() private utilsHelper: UtilsHelper;

	@InjectRepository(Account) private accountRepo: Repository<Account>;

	@RequestMapping({
		path: '/login',
		method: RequestMethod.POST
	})
	async doLogin(@HttpRequest() req): Promise<any> {
		const email: string = req.body.email;
		const password: string = req.body.password;

		if (!email || !password) {
			return Promise.reject({ message: 'Missing data' });
		}

		// Check if the email is valid
		const isValidEmail: boolean = this.utilsHelper.validateEmail(email);
		if (!isValidEmail) {
			return Promise.reject({ message: 'Invalid e-mail address' });
		}

		// Check if the account exists
		const account: Account = await this.accountRepo.findOne({ email: email });
		if (!account || !this.authHelper.encryptCheck(password, account.password)) {
			return Promise.reject({
				message: `Invalid credentials`
			})
		}

		// Check if this account has ben banned
		if (account.type === AccountType.BANNED) {
			return Promise.reject({
				message: `This account has been banned<br />
				<b>Reasson:</b> ${account.banReason}`
			});
		}

		return Promise.resolve({
			account,
			token: this.authHelper.genToken(account.id)
		});
	}

	@RequestMapping({
		path: '/register',
		method: RequestMethod.POST
	})
	async doRegister(@HttpRequest() req): Promise<any> {
		const email: string = req.body.email;
		const password: string = req.body.password;
		const confirmPassword: string = req.body.confirm_password;
		const acceptTerms: boolean = req.body.terms;

		if (!email || !password || !confirmPassword || !acceptTerms) {
			return Promise.reject({ message: 'Missing data' });
		}

		// Accept terms
		if (!acceptTerms) {
			return Promise.reject({ message: 'You must accept the terms' });
		}

		// Check if the email is valid
		const isValidEmail: boolean = this.utilsHelper.validateEmail(email);
		if (!isValidEmail) {
			return Promise.reject({ message: 'Invalid e-mail address' });
		}

		// Check password match
		if (password !== confirmPassword) {
			return Promise.reject({ message: 'Passwords do not match' });
		}

		// Check password length
		if (password.trim().length < 8) {
			return Promise.reject({ message: 'Password must be at least 8 characters long' });
		}

		// Check if the account exists
		const account: Account = await this.accountRepo.findOne({ email: email });
		if (account) {
			return Promise.reject({ message: 'This e-mail address is already registered' });
		}

		// Create the account
		const newAccount: Account = new Account();
		newAccount.email = email;
		newAccount.password = this.authHelper.encrypt(password);
		await this.accountRepo.insert(newAccount);
	}
}
