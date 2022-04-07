import 'reflect-metadata';
import { Express, IRoute, Response, NextFunction, RequestHandler, Router } from 'express';
import { CommandLine } from '../command/commands';
import { Type, TypeDecorator, TypedMethodDecorator, PromiseMethod } from '../main';
import { createConnection, Connection, FindOperator, FindOperatorType, getRepository } from 'typeorm';
import { Map, HashMap } from './../main/map';
import { addToInjectionChain, processInjectionChain, getFromInjectionChain } from './injection';
import { ScheduleAll } from './cron';
import { HttpStatus, HttpError } from '../main/http';
import express from 'express';
import addRequestId from 'express-request-id';
import * as jwt from 'jsonwebtoken';
import session from 'express-session';
import { Server as ioServer } from "socket.io";

import { Config, SystemParams } from '../../config';
import { Account } from '../../entity/Account';
const http = require('http');

class FindOperatorWithExtras<T> extends FindOperator<T> {
	constructor(
		type: FindOperatorType | 'ilike',
		value: FindOperator<T> | T,
		useParameter?: boolean,
		multipleParameters?: boolean,
	) {
		// @ts-ignore
		super(type, value, useParameter, multipleParameters);
	}
}

/**
 * Find Options Operator.
 * Example: { someField: Like("%some sting%") }
 */
export function ILike<T>(
	value: T | FindOperator<T>,
): FindOperatorWithExtras<T> {
	return new FindOperatorWithExtras('ilike', value);
}

const lastRequests: any = {};

const checkToken = (req, res, next) => {
	const requestAddrees = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	if (req.method === 'POST') {
		// check last request
		if (lastRequests[requestAddrees]) {
			const now = new Date();
			const lastRequest = new Date(lastRequests[requestAddrees]);
			const diff = now.getTime() - lastRequest.getTime();
			if (diff < CommandLine.requestDelay) {
				console.log(`[SPAM] Spamming detected and protected from`, requestAddrees);
				return res.status(HttpStatus.FORBIDDEN).json({
					message: 'Too many requests, please wait and try again later.'
				});
			}
		}

		lastRequests[requestAddrees] = new Date();
	}

	const token = req.headers['x-access-token'] || req.headers['authorization'] || req.headers['Authorization'];
	if (!token) {
		return res.status(HttpStatus.UNAUTHORIZED).json({
			message: 'No token provided.'
		});
	} else {
		if (!token.startsWith('Bearer ')) {
			return res.status(HttpStatus.UNAUTHORIZED).json({
				message: 'Invalid token format.'
			});
		}

		const realToken = token.slice(7, token.length);
		jwt.verify(realToken, Config.token, (err, decoded) => {
			if (err) {
				return res.status(HttpStatus.UNAUTHORIZED).json({
					message: 'Token is not valid'
				});
			} else {
				if (req.body != undefined && req.body._accountId) {
					req.getAccount = () => req.body._accountId;
				} else {
					req.getAccount = () => decoded.id || decoded;
				}

				next();
			}
		});
	}
};

export const Socket: {
	server: ioServer
} = {
	server: null
};

export let FieldsToRegister = [];

export interface MappingParameter {
	index: number,
	path: string[],
	type: Type<any>,
	decorator: string
}

export interface MappingParameter {
	index: number,
	path: string[],
	type: Type<any>,
	decorator: string
}

export interface MappingMetadata {
	options?: RequestOptions<string>,
	property: string,
	returnType?: Type<any>,
	returnTypeName?: string,
	parameters: MappingParameter[]
}

export interface ControllerMetadata<T> {
	type?: Type<T>,
	app?: Router,
	options?: RequestOptions<string[] | string>,
	mappings: Map<MappingMetadata>,
	params: Map<MappingMetadata>
}

export function RequestFiles<T>(): ParameterDecorator {
	return paramDecoratorator('RequestFiles', 'req', 'files');
}

export const ServerMetadata: Map<ControllerMetadata<any>> = new HashMap<ControllerMetadata<any>>();
export let ServerDataOptions: ServerOptions;
export interface ServerOptions {
	sessionOptions: session.SessionOptions;
	controllers?: Type<any>[];
	helpers?: Type<any>[];
	cron?: Type<any>[];
	use?: RequestHandler[];
}

export enum RequestMethod {
	GET		= 'GET',
	POST	= 'POST',
	DELETE	= 'DELETE',
	PUT		= 'PUT',
	ALL		= 'ALL'
}

export interface RequestOptions<T> {
	path?: T,
	method?: RequestMethod,
	errorCode?: HttpStatus,
	isFile?: boolean,
	errorMessage?: string,
	authenticated?: boolean
}

const getDefaultOptions = <T>(path: T): RequestOptions<T> => ({
	path: path,
	method: RequestMethod.GET,
	errorCode: 500,
	authenticated: true
});

function paramDecoratorator<T>(decorator: string, ...path: string[]) {
	return (target: Object, propertyKey: string, parameterIndex: number) => {
		const target_name = target.constructor.name;
		const type = Reflect.getMetadata('design:paramtypes', target, propertyKey)[parameterIndex];
		ServerMetadata.changeWithDefault(target_name, { mappings: new HashMap<MappingMetadata>(), params: new HashMap<MappingMetadata>() }, (value) => {
			value.mappings.changeWithDefault(propertyKey, {
				property: propertyKey,
				parameters: []
			}, (prop) => {
				prop.parameters.push({
					index: parameterIndex,
					path: path,
					type: type,
					decorator: decorator
				});

				return prop;
			});

			return value;
		});
	};
}

export function HttpRequest(): ParameterDecorator {
	return paramDecoratorator('HttpRequest', 'req');
}

export function HttpResponse(): ParameterDecorator {
	return paramDecoratorator('HttpResponse', 'res');
}

export function RequestParam<T>(name: string): ParameterDecorator {
	return paramDecoratorator('RequestParam', 'req', 'query', name);
}

export function PathVariable<T>(name: string): ParameterDecorator {
	return paramDecoratorator('PathVariable', 'req', 'params', name);
}

export function RequestBody<T>(): ParameterDecorator {
	return paramDecoratorator('RequestBody', 'req', 'body');
}

export function Server(options: ServerOptions): TypeDecorator {
	return (target: Type<any>) => {
		addToInjectionChain(target);

		createServerAndListen(options).then(() => {
			ScheduleAll();
			console.log(`[SERVER] Listening to port:`, CommandLine.port);
		});

		return target;
	}
}

function createServerAndListen(options: ServerOptions) {
	ServerDataOptions = options;
	return new Promise((resolve, reject) => {
		connect().then((connection) => {
			processInjectionChain();
			const AppServer: Express = express();

			const appRouter = Router({ mergeParams: true });

			AppServer.use([session(options.sessionOptions), addRequestId()]);
			AppServer.use(options.use || []);

			ServerMetadata.forEachAsync((key, value) => {
				value.app = Router({ mergeParams: true });
				value.mappings.forEach((key, map) => {
					handleMapping(value, map);
				});

				if (value.options != undefined && value.options.authenticated) {
					appRouter.use(value.options.path, checkToken, value.app);
				} else {
					appRouter.use(value.options.path, value.app);
				}
			}).then(() => {
				let httpServer = http.Server(AppServer);
				AppServer.use('/', appRouter);
				AppServer.get('/', (req, res) => {
					res.json({ message: `Welcome to ${SystemParams.app.name}!` })
				});

				const io = new ioServer(httpServer);
				io.on('connection', (socket: any) => {
					if (socket.handshake.query.id) {
						getRepository(Account).findOne({
							id: socket.handshake.query.id
						}).then((user: Account) => {
							if (user) {
								user.socketId = socket.id;
								user.save();
							}
						})
					}

					socket.on('disconnect', () => {
						getRepository(Account).findOne({
							socketId: socket.id
						}).then((user: Account) => {
							if (user) {
								user.socketId = null;
								user.save();
							}
						})
					});
				});

				Socket.server = io;
				httpServer.listen(CommandLine.port, () => {
					resolve({});
				});
			});

		}).catch((err) => {
			console.log('[SERVER] Error while connecting to database.');
			console.error(err);
		});
	})
}

export function Controller(options?: RequestOptions<string[]>): TypeDecorator {
	return (target: Type<any>) => {
		const target_name = target.name;
		addToInjectionChain(target);
		ServerMetadata.changeWithDefault(target_name, { mappings: new HashMap<MappingMetadata>(), params: new HashMap<MappingMetadata>() }, (value) => {
			value.options = Object.assign(getDefaultOptions(['/']), options);
			value.type = target;

			return value;
		});

		return target;
	}
}

export function ParameterParser(...name: string[]): TypedMethodDecorator<PromiseMethod> {
	return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<PromiseMethod>) => {
		const target_name = target.constructor.name;
		ServerMetadata.changeWithDefault(target_name, { mappings: new HashMap<MappingMetadata>(), params: new HashMap<MappingMetadata>() }, (value) => {
			name.forEach((key) => {
				value.params.put(key, {
					property: propertyKey,
					parameters: []
				});
			})

			return value;
		});

		return descriptor;
	};
}

export function RequestMapping(options?: RequestOptions<string>): MethodDecorator {
	return <T>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
		const target_name = target.constructor.name;
		const returnType = Reflect.getMetadata('design:returntype', target, propertyKey);
		ServerMetadata.changeWithDefault(target_name, { mappings: new HashMap<MappingMetadata>(), params: new HashMap<MappingMetadata>() }, (value) => {
			value.mappings.changeWithDefault(propertyKey, {
				property: propertyKey,
				parameters: []
			}, (propValue) => {
				propValue.property = propertyKey;
				propValue.options = Object.assign({ path: '' }, options);
				propValue.returnType = returnType;
				propValue.returnTypeName = returnType != undefined ? returnType.prototype.constructor.name : undefined;

				return propValue;
			});

			return value;
		});

		return descriptor;
	};
}
export class ApiResponse {
	public value: any;
	public type: any;
	public status: any;
	constructor(value, type, status?: any) {
		this.value = value;
		this.type = type;
		this.status = status || 200;
	}
}

function handleMapping<T>(controllerMeta: ControllerMetadata<T>, meta: MappingMetadata) {
	const options = Object.assign(Object.assign({}, controllerMeta.options, { path: '' }), meta.options);
	options.path = options.path == '' || options.path == undefined ? '/' : options.path;
	getExpressMatchingMethod(controllerMeta.app.route(options.path), options.method, (req: any, res: Response, next: NextFunction) => {
		const instance = getFromInjectionChain(controllerMeta.type);

		const method = instance[meta.property];
		const parameters = meta.parameters;
		let promiseArr = [];
		Object.keys(req.params).forEach((name) => {
			controllerMeta.params.get(name).ifPresent((metaParam) => {
				const paramMethod = instance[metaParam.property];
				promiseArr.push(paramMethod.apply(instance, [req.params[name], name]).then((nValue) => {
					req.params[name] = nValue;
					return nValue;
				}));
			});
		});

		if (promiseArr.length == 0) {
			promiseArr = [Promise.resolve({})];
		}

		return Promise.all(promiseArr).then((result) => {
			const args = parameters.sort((v1, v2) => {
				return v1.index - v2.index
			}).map((param) => {
				let value = param.path.reduce((pv, cv) => {
					if (pv != undefined) {
						return pv[cv];
					}
					return undefined;
				}, {
					req: req,
					res: res
				});

				if (param.decorator == 'RequestBody') {
					return Object.assign(new param.type(), value);
				}

				return value;
			});

			const value = method.apply(instance, args);

			if (meta.returnTypeName == undefined) {
				meta.returnTypeName = value.constructor.name;
			}
			if (options.isFile) {
				value.then(resp => {
					res.end(resp)
				}).catch((err) => {
					const status = err.status != undefined ? err.status : (options.errorCode != undefined ? options.errorCode : HttpStatus.INTERNAL_SERVER_ERROR);
					const error = new HttpError(status, options.errorMessage || err.message, err);
					res.status(status).send(error);
				});
				return;
			}

			switch (meta.returnTypeName) {
				case 'Observable': {
					value.subscribe((value) => {
						res.json(value);
					});
					break;
				}
				case 'ApiResponse': {
					let response: ApiResponse = value;
					if (response.type == 'file') {
						res.status(response.status ? response.status : HttpStatus.OK).send(response.value);
						return;
					}
					break;
				}
				case 'Promise': {
					value.then((value) => {
						res.json(value);
					}).catch((err) => {
						const status = err.status != undefined ? err.status : (options.errorCode != undefined ? options.errorCode : HttpStatus.INTERNAL_SERVER_ERROR);
						const error = new HttpError(status, options.errorMessage || err.message);
						res.status(status).send(error);
					});
					break;
				}
				default: {
					res.send(value);
					return;
				}
			}
		}).catch((err) => {
			console.error(err);
			res.status(err.status != undefined ? err.status : HttpStatus.INTERNAL_SERVER_ERROR).send(err);
		});

	});
};

function getExpressMatchingMethod<T>(route: IRoute, method: RequestMethod, ...handlers: RequestHandler[]): IRoute {
	switch (method) {
		case RequestMethod.GET: return route.get(handlers);
		case RequestMethod.POST: return route.post(handlers);
		case RequestMethod.PUT: return route.put(handlers);
		case RequestMethod.DELETE: return route.delete(handlers);
		case RequestMethod.ALL: return route.all(handlers);
		default: return route.get(handlers);
	}
}

function connect(): Promise<Connection> {
	return createConnection(CommandLine.connection);
}
