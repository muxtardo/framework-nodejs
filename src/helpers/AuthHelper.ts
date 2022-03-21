import { Helper } from '../lib/decorators/injection';
import { Config } from '../config';

import * as jwt from 'jsonwebtoken';

const Cryptr = require('cryptr');

@Helper()
export class AuthHelper {
	private cryptr: any;

	public constructor() {
		this.cryptr = new Cryptr('myTotalySecretKey');
	}

	public encrypt(value: string): string {
		return this.cryptr.encrypt(value);
	}

	public decrypt(value: string): string {
		return this.cryptr.decrypt(value);
	}

	public encryptCheck(value: string, hash: string): boolean {
		return value == this.decrypt(hash);
	}

	public genToken(id): string {
		return jwt.sign({ id }, Config.token, {
			expiresIn: 60 * 60
		});
	}

	public expiration(token): string {
		let data: any
		jwt.verify(token, Config.token, (err, decoded) => {
			if (!err) {
				data = decoded.exp
			}
		});
		return data
	}
}
