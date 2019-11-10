const SiteMonitor = require("./SiteMonitor.js");
const requester = require("./GoogleApiRequester.js");
const googleInterface = require("./GoogleInterface.js");
const {googlePollRate} = require("./config.json");
const {fields, categories} = require("./Globals");

class GoogleMonitor extends SiteMonitor {
    /**
     * @inheritDoc
     */
    setupMonitoring(taskList) {
        this.monitoredList = taskList;
        setInterval(this.doPoll.bind(this), googlePollRate * 1000);
        console.log(`Setup google polling at interval of ${googlePollRate} second(s)`)
    }

    async doPoll() {
        console.log("Beginning polling of google site");

        let rawTasks = await requester.getAllTasks();
        let allTasks = new Set(this.monitoredList.getTasks().map(task => task.getField(fields.GOOGLE_ID)));

        for (let rawTask of rawTasks) {
            let task = this.monitoredList.getTask(task => googleInterface.doesTaskMatchData(task, rawTask));
            if (task) { // Existing task
                allTasks.delete(task.getField(fields.GOOGLE_ID));

                let remote = this.monitoredList.getDefaultTask();
                googleInterface.loadIntoTask(rawTask, remote);

                let alteredFields = this.detectDifferences(task, remote);
                if (alteredFields.length !== 0) {
                    this.onTaskAltered(task, remote, alteredFields);
                    this.alteredCallback(task, alteredFields);
                }
            } else { // Created task
                task = this.onTaskCreated(rawTask);
                this.createdCallback(task);
            }
        }

        for (let taskId of allTasks) {
            let task = this.monitoredList.getTask(task => task.getField(fields.GOOGLE_ID) === taskId);
            this.onTaskDeleted(task);
            this.deletedCallback(task);
        }
        console.log("Finished polling of google site")
    }

    /**
     *
     * @param local {Task}
     * @param remote {Task}
     * @param alteredFields {string[]}
     * @return {string[]} True if the task was updated, false otherwise
     */
    onTaskAltered(local, remote, alteredFields) {
        for (let alteredField of alteredFields) {
            local.setField(alteredField, remote.getField(alteredField))
        }

        console.log(`Card '${local.getField(fields.NAME)}' (${local.getField(fields.GOOGLE_ID)}) updated.`);
    }

    /**
     *
     * @param one {Task}
     * @param two {Task}
     * @return {String[]}
     */
    detectDifferences(one, two) {
        let excludedFields = new Set([
            fields.LAST_MODIFIED,
            fields.AVAILABLE_COUNT,
            fields.CLAIMED_COUNT,
            fields.COMPLETED_COUNT,
            fields.STATUS,
            fields.EXTERNAL_URL,
            fields.MENTORS,
        ]);
        let result = [];
        //todo: Improve?
        for (let field of Object.values(fields)) {
            if (excludedFields.has(field)) {
                continue;
            }
            let oneVal = one.getField(field);
            let twoVal = two.getField(field);
            // Different types means different values
            if (typeof oneVal !== typeof twoVal) {
                result.push(field);
                continue;
            }
            // Arrays are the same, skip
            if ((oneVal instanceof Array) && oneVal.equals(twoVal)) {
                continue;
            }
            // Else just do basic comparison
            if (one.getField(field) !== two.getField(field)) {
                result.push(field);
            }
        }
        return result;
    }

    /**
     *
     * @param rawTask {RawGoogle}
     * @return {Task}
     */
    onTaskCreated(rawTask) {
        let newCard = this.monitoredList.createTask();
        googleInterface.loadIntoTask(rawTask, newCard);
        console.log(`Card '${newCard.getField(fields.NAME)}' (${newCard.getField(fields.GOOGLE_ID)}) created.`);
        return newCard;
    }

    /**
     *
     * @param task {Task}
     */
    onTaskDeleted(task) {
        this.monitoredList.deleteThisTask(task);
        console.log(`Card '${task.getField(fields.NAME)}' (${task.getField(fields.GOOGLE_ID)}) deleted.`);
    }
}

module.exports = new GoogleMonitor();