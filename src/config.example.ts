import { Environment } from "./lib/command/commands";
import * as path from 'path';

export const SystemParams: any = {
	app: {
		name: 'Framework NodeJS',
		url: 'http://localhost',
		email: 'example@mail.com'
	}
}

export const Config: Environment = {
	token: 'YourSecretToken',
	path: {
		files: path.join(__dirname, './files/'),
		templates: path.join(__dirname, './templates/')
	},
	mail: {
		active: false,
		transporter: {
			service: 'gmail',
			auth: {
				user: 'example@gmail.com',
				pass: 'YourEmailPassword'
			}
		}
	},
	connection: {
		type: 'mysql',
		host: 'localhost',
		username: 'YourUsername',
		password: 'YourPassword',
		database: 'YourDatabase',
		synchronize: true,
		logging: false,
		entities: [ path.join(__dirname, 'entity') + '/*' ],
		migrations: [ path.join(__dirname, 'migrations') + '/*' ],
		subscribers: [ path.join(__dirname, 'subscriber') + '/*' ]
	}
}
