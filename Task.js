const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');

/**
 * Represents a single task.
 */
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

    /**
     * Loads data from a google data payload.
     *
     * @param data {json} The google api result for this task.
     */
    loadFromGoogle(data) {
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

    /**
     * Loads the task from trello card data.
     * Makes further api calls to obtain the custom field data
     *
     * @param data {json} The Trello card data to load in
     * @return {Promise} Returns a new promise that is only finished when all the data has been loaded
     */
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

        //TODO: Get the custom field data at the same time as the card data
        return requester.getCustomFields(this.trelloId).then(body => {
            /* Copy across so we know what fields are NOT set */
            this.unloadedFields = {};
            Object.keys(this.customFields).forEach(key => this.unloadedFields[this.customFields[key]] = key);

            body.customFieldItems.forEach(this.handleField, this);

            //TODO: This is really ugly
            /* Update false entries */
            if (this.customFields.isBeginner in this.unloadedFields) {
                this.isBeginner = false;
            }
            if (this.customFields.isCode in this.unloadedFields) {
                this.categories[categories.CODING] = false;
            }
            if (this.customFields.isDesign in this.unloadedFields) {
                this.categories[categories.DESIGN] = false;
            }
            if (this.customFields.isDocs in this.unloadedFields) {
                this.categories[categories.DOCS_TRAINING] = false;
            }
            if (this.customFields.isOutResearch in this.unloadedFields) {
                this.categories[categories.OUTRESEARCH] = false;
            }
            if (this.customFields.isQa in this.unloadedFields) {
                this.categories[categories.QA] = false;
            }
        });
    }

    /**
     * Updates this task with the data from the given custom field.
     * Also removes this field from the lis to of unloaded fields
     *
     * @param field {json} The custom field to load the data from
     */
    handleField(field) {
        delete this.unloadedFields[field.idCustomField];
        //TODO: This is really ugly
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

    /**
     * Updates the card on trello with the data in this task
     *
     * _This will overwrite the current card information_
     *
     * @return {Promise} A promise that is resolved when all the fields have been written to
     */
    async writeToTrello() {
        console.log(`Writing "${this.name}" (${this.trelloId}) to trello`);
        const promises = [];
        if (this.trelloId) {
            //TODO: This is really ugly
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

    /**
     * Updates the task on GCI to the data in the current task
     *
     * _This will overwrite the current task information_
     */
    writeToGoogle() {
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

        if (!this.googleId) {
            console.warn(`Making new google task for ${this.name} (${this.trelloId})`);
            requester.googlePost(data).then(body => {
                this.googleId = body.id;
                /* We write to trello to write the google task id */
                this.writeToTrello();
            });
        } else {
            requester.updateGoogle(this.googleId, data);
        }
    }
}


module.exports = Task;