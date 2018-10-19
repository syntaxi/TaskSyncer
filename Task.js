const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');

/**
 * Represents a single task.
 * @namespace
 * @property {boolean} isDoc True if the task has the "Documentation & Training" category
 */
class Task {
    constructor() {
        /* Trello custom field id's */
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
            googleId: new CustomTaskField('id', this.customFields.googleId, 'number'),
            trelloId: new BasicTaskField((data, value) => value || data['private_metadata'], 'id'),

            name: new BasicTaskField('name', 'name'),
            description: new BasicTaskField('description', 'desc'),
            status: new TaskField('status'),//TODO: Add this to trello cards
            mentors: new TaskField('mentors'),//TODO: Add this to trello cards
            externalUrl: new TaskField('external_url'), //TODO: Add this to trello cards
            maxInstances: new CustomTaskField(
                'max_instances',
                this.customFields.instances,
                'number',
                1),
            tags: new CustomTaskField('tags',
                this.customFields.tags,
                field => field.text.split(/\s*,\s*/i),
                []),
            isBeginner: new CustomTaskField(
                'is_beginner',
                this.customFields.isBeginner,
                'boolean',
                false),
            days: new CustomTaskField(
                'time_to_complete_in_days',
                this.customFields.days,
                'number',
                3),


            isCode: new CustomTaskField(
                data => categories.CODING in data,
                this.customFields.isCode,
                'boolean',
                false,
                data => {
                    if (this.isCode) {
                        data.push(categories.CODING);
                    }
                    return data;
                }),
            isDesign: new CustomTaskField(
                data => categories.DESIGN in data,
                this.customFields.isDesign,
                'boolean',
                false,
                data => {
                    if (this.isDesign) {
                        data.push(categories.DESIGN);
                    }
                    return data;
                }),
            isDocs: new CustomTaskField(
                data => categories.DOCS_TRAINING in data,
                this.customFields.isDocs,
                'boolean',
                false,
                data => {
                    if (this.isDocs) {
                        data.push(categories.DOCS_TRAINING);
                    }
                    return data;
                }),
            isQa: new CustomTaskField(
                data => categories.QA in data,
                this.customFields.isQa,
                'boolean',
                false,
                data => {
                    if (this.isQa) {
                        data.push(categories.QA);
                    }
                    return data;
                }),
            isOutResearch: new CustomTaskField(
                data => categories.OUTRESEARCH in data,
                this.customFields.isOutResearch,
                'boolean',
                false,
                data => {
                    if (this.isOutResearch) {
                        data.push(categories.OUTRESEARCH);
                    }
                    return data;
                }),


            lastModified: new TaskField('last_modified'),
            claimedCount: new TaskField('claimed_count'),
            availableCount: new TaskField('available_count'),
            completedCount: new TaskField('completed_count')

        };

        for (let field in this.fields) {
            Object.defineProperty(this, field, {
                get: this.fields[field].getValue.bind(this.fields[field]),
                set: this.fields[field].setValue.bind(this.fields[field])
            });
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
            body.customFieldItems.forEach(this.handleField, this);

            /* Update false entries for the checkboxes */
            Object.values(this.fields)
                .filter(field => field instanceof CustomTaskField)
                .forEach(field => field.handleNotPresent());
        });
    }

    /**
     * Updates this task with the data from the given custom field.
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
        let data = {};
        for (let field in this.fields) {
            data = field.writeToGoogle(data)
        }
        data = {
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