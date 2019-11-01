const Promise = require("bluebird");

/**
 * The base class that implements the common requesting components of all requester types.
 * In particular implements rate limiting to ensure that calls don't fail due to being rate limited
 */
const request = require("request-promise");

class BaseApiRequester {
    constructor(requestsLimit) {
        this.requestsQueue = [];
        this.requestsLimit = requestsLimit;
        this.requestsCount = 0;
    }

    /**
     * This should be overridden by subclasses in order for them to identify themselves in the logs
     * @returns {string} The (human readable) name of this logger
     */
    getName() {
        return "Unnamed";
    }

    /**
     * Stops the background resetting of request counts.
     */
    stop() {
        clearInterval(this.interval)
    }

    /**
     * Start the background resetting of request counts;
     */
    start() {
        this.interval = setInterval(this.resetRateLimit.bind(this), 10000);
    }

    /**
     * reset the number of requests made back  to zero.
     * This allows requests to made again.
     */
    resetRateLimit() {
        if (this.requestsCount !== 0) {
            console.log(`Resetting requests count for ${this.getName()}`)
        }
        this.requestsCount = 0;
        this.processRequests();
    }

    /**
     * Attempt to process as many requests as possible until the limit is reached
     */
    processRequests() {
        while (this.requestsCount <= this.requestsLimit && this.requestsQueue.length !== 0) {
            let [payload, resolve, reject] = this.requestsQueue.shift();
            request(payload)
                .then(resolve)
                .catch(reason => {
                    console.log(`Call from ${this.getName()} (${payload.uri}) failed: ${reason}`);
                    if (reject) {
                        return reject(reason);
                    } else {
                        return reason;
                    }
                });
            this.requestsCount += 1;
        }
    }

    /**
     * Add a request to the back of the queue
     * @param payload The request to made
     * @returns {Promise} A promise that will be fulfilled with the response
     */
    queueRequest(payload) {
        const promise = new Promise((resolve, reject) =>
            this.requestsQueue.push(
                [payload, resolve, reject]
            )
        );
        this.processRequests();
        return promise;
    }
}

module.exports = BaseApiRequester;