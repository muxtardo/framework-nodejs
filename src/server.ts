import { Server } from './lib/decorators/server';
import { Init } from './lib/lifecycle/Init';
import * as bodyParser from 'body-parser';
import cors from 'cors';

// Configs
import { Config, SystemParams } from './config';

// Controlers
import { AccountController } from './controllers/AccountController';
import { AuthController } from './controllers/AuthController';

// Helpers
import { AuthHelper } from './helpers/AuthHelper';
import { HttpHelper } from './helpers/HttpHelper';
import { UtilsHelper } from './helpers/UtilsHelper';

// Cron
import { ExampleCron } from './cron/ExampleCron';

@Server({
	controllers: [
		AccountController,
		AuthController
	],
	cron: [
		ExampleCron
	],
	helpers: [
		AuthHelper,
		HttpHelper,
		UtilsHelper
	],
	use: [
		cors({ origin: true, credentials: true }),
		bodyParser.urlencoded({ extended: true }),
		bodyParser.json()
	],
	sessionOptions: {
		secret: Config.token,
		resave: false,
		saveUninitialized: true
	}
})

export class AppServer implements Init {
	onInit() {
		console.log(`[SERVER] ${SystemParams.app.name} is online!`);
	}
}
