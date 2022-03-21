import * as nodemailer from "nodemailer";
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import moment from "moment";

import { Config, SystemParams } from "../config";

export class MailService {
	constructor(
		public to?: string,
		public subject?: string,
		public message?: string
	) { }

	public send(template?: string, data?: any) {
		if (!Config.mail.active) {
			return;
		}

		const mailOptions = {
			from: `"${SystemParams.app.name}" <${SystemParams.app.email}>`,
			to: this.to,
			subject: this.subject,
			html: this.message
		};

		const transporter = nodemailer.createTransport(Config.mail.transporter);

		if (template) {
			this.readHTMLFile(path.resolve(Config.path.template, `${template}.html`), (err, html) => {
				const templateFn = handlebars.compile(html);
				mailOptions.html = templateFn(Object.assign(data || {}, {
					appName: SystemParams.app.name,
					appUrl: SystemParams.app.url,
					moment: moment()
				}));
			});
		}

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				console.error('sendMail', error);
				return false;
			} else {
				console.info('sendMail', info)
				return true;
			}
		});
	}

	private readHTMLFile(path: string, callback: any) {
		fs.readFile(path, {
			encoding: 'utf-8'
		}, (err, html) => {
			if (err) {
				throw err;
			} else {
				callback(null, html);
			}
		});
	};
}
