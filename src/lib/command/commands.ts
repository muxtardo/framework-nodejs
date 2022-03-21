import { ConnectionOptions } from "typeorm";

import { Config } from "../../config";

interface Command<T> {
	default: T,
	alias: string[]
}

type Commands<T> = {
	[P in keyof T]: Command<T[P]>;
};

export const comandList: Commands<Environment> = {
	port: {
		default: 3001,
		alias: ['p']
	},
	requestDelay: {
		default: 3000,
		alias: ['rd']
	},
	connection: {
		default: undefined,
		alias: []
	},
	mail: {
		default: { active: false },
		alias: []
	},
};

export interface Environment {
	port?: number;
	path?: any;
	token?: string;
	mail: any;
	connection: ConnectionOptions;
	requestDelay?: number;
}

export const CommandLine: Environment = CommandValues();

function defaultValues() {
	return Object.keys(comandList).map((key) => ({
		key: key,
		value: comandList[key].default
	})).reduce((pv, cv) => {
		pv[cv.key] = cv.value;
		return pv;
	}, {});
}

function CommandValues(): Environment {
	let args: any = {};
	process.argv.slice(2).forEach((arg) => {
		const spl = arg.split("=");
		if (spl[0] != undefined) {
			if (spl[1] != undefined) {
				if (!isNaN(Number(spl[1]))) {
					args[spl[0].replace('--', '')] = Number(spl[1]);
				} else if (spl[1] == 'true' || spl[1] == 'false') {
					args[spl[0].replace('--', '')] = spl[1] == 'true' ? true : false;
				} else {
					args[spl[0].replace('--', '')] = spl[1];
				}
			} else {
				args[spl[0].replace('--', '')] = true;
			}
		}
	});

	const env: any = defaultValues();
	return {
		...env,
		...Config,
		...args
	};
}
