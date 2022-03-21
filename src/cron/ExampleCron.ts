import { Cron } from "../lib/decorators/injection";
import { Task } from "../lib/decorators/cron";
import { Init } from "../lib/lifecycle/Init";

@Cron()
export class ExampleCron extends Init {
	@Task('* * * * *')
	async runExample() {
		console.log('[CRON] Example task');
    }

	public onInit(): void {
		console.log('[CRON] Example initialized');
	}
}
