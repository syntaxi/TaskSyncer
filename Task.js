const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');

class TaskField {
    constructor(googleHandler, initialValue) {
        this.parseGoogle = this._loadArgument(googleHandler);
        this.value = initialValue || null;
    }

    _loadArgument(argument) {
        if (typeof argument === "string") {
            return (data) => data[argument];
        } else if (typeof argument === "function") {
            return argument;
        } else {
            throw new TypeError(`Field (${argument}) is not a String or Function`);
        }
    }

    loadFromGoogle(data) {
        this.value = this.parseGoogle(data, this.value)
    }

    loadFromTrello() {

    }

    getValue() {
        return this.value
    }

    setValue(data) {
        this.value = data;
    }
}

class BasicTaskField extends TaskField {
    constructor(googleHandler, trelloHandler, initialValue) {
        super(googleHandler, initialValue);
        this.parseTrello = this._loadArgument(trelloHandler);
    }

    loadFromTrello(data) {
        this.value = this.parseTrello(data)
    }
}

class CustomTaskField extends TaskField {
    constructor(googleHandler, fieldId, trelloHandler, initialValue) {
        super(googleHandler, initialValue);
        this.fieldId = fieldId;
        if (typeof this.parseTrello === "string") {
            switch (trelloHandler) {
                case 'number':
                    this.parseTrello = field => parseInt(field.number);
                    break;
                case 'boolean':
                    this.parseTrello = field => field.checked === 'true';
                    break;
                default:
                    throw new TypeError(`Type of trelloHandler (${trelloHandler}) was not known `)
            }
            this.type = this.parseTrello;
        } else if (typeof trelloHandler === 'function') {
            this.parseTrello = this._loadArgument(trelloHandler);
            this.type = 'custom';
        } else {
            throw new TypeError(`Field trelloHandler (${trelloHandler}) is not a String or Function`);
        }
    }

    handleNotPresent() {
        if (this.type === 'boolean') {
            this.setValue(false)
        }
    }

    doesFieldMatch(field) {
        return field.idCustomField === this.fieldId
    }

    loadFromTrello(field) {
        this.value = this.parseTrello(field.value, this.value)
    }

    toString() {
        return (this.value || "null").toString()
    }
}

/**
 * Represents a single task.
 */
class Task {
    constructor() {
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
        };

        /**
         * All the fields for a task
         * @type {{TaskField}}
         */
        this.fields = {
            googleId: new CustomTaskField('id', this.customFields.googleId, field => parseInt(field.number)),
            trelloId: new BasicTaskField((data, value) => value || data['private_metadata'], 'id'),

            name: new BasicTaskField('name', 'name'),
            description: new BasicTaskField('description', 'desc'),
            status: new TaskField('status'),//TODO: Add this to trello cards
            mentors: new TaskField('mentors'),//TODO: Add this to trello cards
            externalUrl: new TaskField('external_url'), //TODO: Add this to trello cards
            maxInstances: new CustomTaskField(
                'max_instances',
                this.customFields.instances,
                field => parseInt(field.number)),
            tags: new CustomTaskField('tags',
                this.customFields.tags,
                field => field.text.split(/\s*,\s*/i)),
            isBeginner: new CustomTaskField(
                'is_beginner',
                this.customFields.isBeginner,
                field => field.checked === "true"),
            days: new CustomTaskField(
                'time_to_complete_in_days',
                this.customFields.days,
                field => parseInt(field.number)),

            isCode: new CustomTaskField(
                data => categories.CODING in data,
                this.customFields.isCode,
                field => field.checked === 'true'),
            isDesign: new CustomTaskField(
                data => categories.DESIGN in data,
                this.customFields.isDesign,
                field => field.checked === 'true'),
            isDocs: new CustomTaskField(
                data => categories.DOCS_TRAINING in data,
                this.customFields.isDocs,
                field => field.checked === 'true'),
            isQa: new CustomTaskField(
                data => categories.QA in data,
                this.customFields.isQa,
                field => field.checked === 'true'),
            isOutResearch: new CustomTaskField(
                data => categories.OUTRESEARCH in data,
                this.customFields.isOutResearch,
                field => field.checked === 'true'),

            lastModified: new TaskField('last_modified'),
            claimedCount: new TaskField('claimed_count'),
            availableCount: new TaskField('available_count'),
            completedCount: new TaskField('completed_count')

        };

        for (let field in this.fields) {
            this.__defineGetter__(field, this.fields[field].getValue);
            this.__defineSetter__(field, this.fields[field].setValue);
        }
    }

    /**
     * Loads data from a google data payload.
     *
     * @param data {json} The google api result for this task.
     */
    loadFromGoogle(data) {
        for (let field in this.fields) {
            this.fields[field].loadFromGoogle(data)
        }
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

        /* Load all the basic fields */
        Object.values(this.fields)
            .filter(value => value instanceof BasicTaskField)
            .forEach(field => field.loadFromTrello(data));

        //TODO: Get the custom field data at the same time as the card data
        return requester.getCustomFields(this.trelloId).then(body => {
            /* Copy across so we know what fields are NOT set */
            this.unloadedFields = {};
            Object.keys(this.customFields).forEach(key => this.unloadedFields[this.customFields[key]] = key);

            body.customFieldItems.forEach(this.handleField, this);

            //TODO: This is really ugly
            /* Update false entries as they just don't appear */
            Object.values(this.fields)
                .filter(field => field instanceof CustomTaskField)
                .forEach(field => field.handleNotPresent());
        });
    }

    /**
     * Updates this task with the data from the given custom field.
     * Also removes this field from the lis to of unloaded fields
     *
     * @param field {json} The custom field to load the data from
     */
    handleField(field) {
        Object.values(this.fields)
        /* Only process fields linked with a Custom Field */
            .filter(taskField => taskField instanceof CustomTaskField)
            /* Only process field that match this field's id */
            .filter(taskField => taskField.doesFieldMatch(field))
            /* Load the data for each remaining field */
            .forEach(taskField => taskField.loadFromTrello(field));
        delete this.unloadedFields[field.idCustomField];
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

    toString() {
        let result = [];

        for (let fieldName in this.fields) {
            result.push(`${fieldName} -> ${this.fields[fieldName].getValue()}`);
        }

        return result.join("\n");
    }
}


module.exports = Task;