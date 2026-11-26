import { Usage, UsageError, Problem } from './usage';

export class Monitor {
    usage?: Usage;
    updated?: Date;
    failure?: Problem;
    private active?: Promise<void>;
    private controller = new AbortController();
    private timer?: NodeJS.Timeout;

    constructor(private readonly read: (signal: AbortSignal) => Promise<Usage>,
        private readonly changed: () => void, private readonly foreground: () => boolean) {}

    refresh(): Promise<void> {
        if (this.controller.signal.aborted) return Promise.resolve();
        if (!this.active) {
            this.active = this.update().finally(() => { this.active = undefined; });
        }
        return this.active;
    }
    private async update() {
        try {
            const value = await this.read(this.controller.signal);
            if (this.controller.signal.aborted) return;
            this.usage = value;
            this.updated = new Date();
            this.failure = undefined;
        } catch (error) {
            if (this.controller.signal.aborted) return;
            this.failure = error instanceof UsageError ? error.problem : 'rpc';
        }
        this.changed();
    }
    schedule(seconds: number) {
        clearInterval(this.timer);
        this.timer = setInterval(() => { if (this.foreground()) void this.refresh(); }, seconds * 1000);
    }
    dispose() {
        clearInterval(this.timer);
        this.controller.abort();
    }
}
