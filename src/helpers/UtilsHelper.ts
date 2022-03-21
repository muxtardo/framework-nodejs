import { Connection } from 'typeorm';

import { Persistence, Helper } from "../lib/decorators/injection";

@Helper()
export class UtilsHelper {
	@Persistence() private connection: Connection;

	public validateEmail(emailToValidate: string) {
		const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		return emailRegexp.test(emailToValidate)
	}

	public sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	public hasMetadata(name: string) {
		return this.connection.hasMetadata(name);
	}

	public getRepository(name: string) {
		return this.connection.getRepository(name);
	}
}
