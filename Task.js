const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');

class Task {
    constructor() {
        /* Ids */
        this.googleId = null;
        this.trelloId = null;

        /* Core data */
        this.name = "";
        this.description = "";
        this.status = 1;
        this.maxInstances = 1;
        this.mentors = [];
        this.tags = [];
        this.isBeginner = false;
        this.categories = {};
        this.days = 3;
        this.externalUrl = "";

        /* Extraneous data */
        this.lastModified = "";
        this.claimedCount = 0;
        this.availableCount = 0;
        this.completedCount = 0;

        /* Trello Constants */
        this.customFields = {
            isBeginner: "5bb13d35adbb5244eb5b749d",
            days: "5bb13de3b6a0c658dce16fd5",
            tags: "5bb13e3b05e0cc6f01a9b76f",
            instances: "5bb13e67765a792d213d290b",
            googleId: "5bc2c3822a3cad2dc77409f5",

            isCode: "5bb13d86d728442f22e898e0",
            isDesign: "5bb13d8fc802625a6c30ee61",
            isDocs: "5bb13da34edf5926c83f294a",
            isQa: "5bb13da9f285397f1a80dddc",
            isOutResearch: "5bb13dbc351a9c4e5c93cd1f"
        }
    }

    crosslinkIds() {
        /**
         * Syncs the data between both google and trello.
         *
         * Will only run if there is both a google & trello id.
         */
        if (this.googleId && this.trelloId) {
            this.writeToGoogle()
        }
    }

    loadFromGoogle(data) {
        /***
         * Loads data from a google data payload.
         * This is a json object with fields described by the google api reference.
         */
        this.name = data.name;
        this.googleId = data.id;
        this.description = data.description;
        this.status = data.status;
        this.maxInstances = data.max_instances;
        this.mentors = data.mentors;
        this.tags = data.tags;
        this.isBeginner = data.is_beginner;
        this.days = data.time_to_complete_in_days;
        this.externalUrl = data.external_url;

        data.categories.forEach((item) => this.categories[item] = true);

        /* Extraneous data */
        this.lastModified = data.last_modified;
        this.claimedCount = data.claimed_count;
        this.availableCount = data.available_count;
        this.completedCount = data.completed_count;

        /* Update trello id if we have one. */
        this.trelloId = data.private_metadata || this.trelloId;
    }

    loadFromTrello(data) {
        /**
         * Loads the data from a trello payload.
         * This is the result from querying the card.
         *
         * Makes further calls to the api in order to get the data for each of the custom fields
         *
         * Returns a promise that only activates when all fields have been requested
         */
        this.trelloId = data.id;
        this.description = data.desc;
        this.name = data.name;

        return requester.getCustomFields(this.trelloId).then(body => {
            /* Copy across so we know what fields are NOT set */
            this.loadedFields = {};
            Object.keys(this.customFields).forEach(key => this.loadedFields[this.customFields[key]] = key);

            body.customFieldItems.forEach(this.handleField, this);

            /* Update false entries */
            if (this.customFields.isBeginner in this.loadedFields) {
                this.isBeginner = false;
            }
            if (this.customFields.isCode in this.loadedFields) {
                this.categories[categories.CODING] = false;
            }
            if (this.customFields.isDesign in this.loadedFields) {
                this.categories[categories.DESIGN] = false;
            }
            if (this.customFields.isDocs in this.loadedFields) {
                this.categories[categories.DOCS_TRAINING] = false;
            }
            if (this.customFields.isOutResearch in this.loadedFields) {
                this.categories[categories.OUTRESEARCH] = false;
            }
            if (this.customFields.isQa in this.loadedFields) {
                this.categories[categories.QA] = false;
            }
        });
    }

    handleField(field) {
        /**
         * Updates this task with the data from the given custom field.
         * Handles all the current types.
         */
        delete this.loadedFields[field.idCustomField];
        switch (field.idCustomField) {
            case this.customFields.days:
                this.days = parseInt(field.value.number);
                break;
            case this.customFields.tags:
                this.tags = field.value.text.split(/\s*,\s*/i);
                break;
            case this.customFields.instances:
                this.maxInstances = parseInt(field.value.number);
                break;
            case this.customFields.googleId:
                this.googleId = parseInt(field.value.number);
                break;


            case this.customFields.isBeginner:
                this.isBeginner = field.value.checked === "true";
                break;

            case this.customFields.isCode:
                this.categories[categories.CODING] = field.value.checked === "true";
                break;
            case this.customFields.isDesign:
                this.categories[categories.DESIGN] = field.value.checked === "true";
                break;
            case this.customFields.isDocs:
                this.categories[categories.DOCS_TRAINING] = field.value.checked === "true";
                break;
            case this.customFields.isOutResearch:
                this.categories[categories.OUTRESEARCH] = field.value.checked === "true";
                break;
            case this.customFields.isQa:
                this.categories[categories.QA] = field.value.checked === "true";
                break;
            default:
                console.error(`Unknown field type '${field.id}' on card ${this.name}`);
        }
    }

    async writeToTrello() {
        /**
         * Updates the card on trello with the data in this task
         *
         * _This will overwrite the current card information_
         */
        console.log(`Writing "${this.name}" (${this.trelloId}) to trello`);
        const promises = [];
        if (this.trelloId) {
            /* Set custom fields */
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isBeginner, 'checked', this.isBeginner));

            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isQa, 'checked', categories.QA in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isOutResearch, 'checked', categories.OUTRESEARCH in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isDocs, 'checked', categories.DOCS_TRAINING in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isDesign, 'checked', categories.DESIGN in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isCode, 'checked', categories.CODING in this.categories));

            await promises.push(requester.setCustomField(this.trelloId, this.customFields.googleId, 'number', this.googleId));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.instances, 'number', this.maxInstances));

        } else {
            console.error("Cannot write. Have no trello id")
        }
        return Promise.all(promises);
    }

    writeToGoogle() {
        /**
         * Updates the task on GCI to the data in the current task
         *
         * _This will overwrite the current task information_
         */
        if (this.googleId) {
            const data = {
                id: this.googleId,
                name: this.name,
                description: this.description,
                status: this.status,
                max_instances: this.maxInstances,
                is_beginner: this.isBeginner,
                time_to_complete_in_days: this.days,
                external_url: this.externalUrl,

                last_modified: this.lastModified,
                claimed_count: this.claimedCount,
                available_count: this.availableCount,
                completed_count: this.completedCount,

                private_metadata: this.trelloId,

                mentors: this.mentors,
                tags: this.tags,
                categories: []
            };
            for (let category in this.categories) {
                if (this.categories[category]) {
                    data.categories.push(category)
                }
            }
            requester.updateGoogle(this.googleId, data);
        } else {
            console.error("Cannot write. Have no google id")
        }
    }
}


module.exports = Task;