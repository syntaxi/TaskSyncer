const requester = require("./TrelloApiRequester.js");
const {fields, categories} = require("./Globals");
const {categoryLists, customFields} = require("./config.json");
const ApiInterface = require("./ApiInterface.js");

/**
 * An interface between the Trello Board and the GCI Site
 *
 * @typedef {{
 *      id: string
 *      customFieldItems: [RawCustomField]
 *      dateLastActivity: string
 *      desc: string
 *      idList: string
 *      name: string
 * }} RawTrello
 * 
 * @typedef {{
 *      [idCustomField]: string
 *      value: ({text: string}|undefined|{checked: string}|{number: string})
 * }} RawCustomField
 *
 *
 * @see ApiInterface
 */
class TrelloInterface extends ApiInterface {
    /**
     * @inheritDoc
     */
    updateOtherId(task) {
        return requester.updateCustomField(
            task.getField(fields.TRELLO_ID),
            customFields.googleId,
            this.getCustomFieldFromTask(fields.GOOGLE_ID, task));
    }

    /**
     * @inheritDoc
     */
    loadAllTasks(taskList) {
        return requester.getAllCards().then(rawCards => {
            for (let rawCard of rawCards) {
                let task = taskList.getOrMakeTask(task => this.doesTaskMatchData(task, rawCard));
                this.loadIntoTask(rawCard, task);
                console.log(`Loaded card '${task.getField(fields.NAME)}' from Trello`);
            }
            return taskList;
        });
    }

    /**
     * @inheritDoc
     */
    loadTask(task) {
        return super.loadTask(task); //TODO: Implement
    }

    /**
     * @inheritDoc
     */
    writeTask(task) {
        task.resetUpdatedFields();
        let rawCustomFields = this.customToRaw(task);
        return this.writeOrCreate(task)
            .then(() =>
                this._updateAllFields(task.getField(fields.TRELLO_ID), rawCustomFields))
            .then(() => {
                if (task.wasFieldUpdated(fields.TRELLO_ID)) {// We made a new task
                    console.log(`Card '${task.getField(fields.NAME)}' created on Trello`);
                    task.trelloCardMade = true;
                } else {
                    console.log(`Card '${task.getField(fields.NAME)}' updated on Trello`);
                    task.trelloCardMade = false;
                }
                return task;
            });
    }

    /**
     * Update all the custom fields on a card, waiting for each request to finish before proceeding with the next one
     * @param cardId {string} The id of the card to update
     * @param rawCustomFields {Object.<string, RawCustomField>}
     * @return {Promise<void>} A promise that waits for all fields to be updated
     * @private
     */
    async _updateAllFields(cardId, rawCustomFields) {
        for (let customFieldId in rawCustomFields) {
            if (rawCustomFields.hasOwnProperty(customFieldId)) {
                await requester.updateCustomField(cardId, customFieldId, rawCustomFields[customFieldId]);
            }
        }
    }

    /**
     * Creates a new trello card.
     *
     * @param task {Task} The task to create the card for
     * @return {Promise<RawTrello>} The raw data for the created task
     */
    createCard(task) {
        let cardCategories = task.getField(fields.CATEGORIES);
        let listId = categoryLists["1"]; //TODO replace this is a specific "no category list"
        if (cardCategories.length !== 0) {
            listId = categoryLists[cardCategories.pop().toString()];
        }

        let rawMain = this.mainToRaw(task);
        delete rawMain["id"];
        rawMain["idList"] = listId;
        return requester.createCard(rawMain)
            .tap(response => task.setField(fields.TRELLO_ID, response["id"]));
    }

    /**
     * Attempts to either write the main data to a pre-existing entry,
     * If that fails, then falls back to creating a new entry and updating that instead
     *
     * This does not write any custom field data to the entry
     *
     * @param task {Task} The task to update/create
     * @return {Promise<RawTrello>} The raw card data
     */
    writeOrCreate(task) {
        if (task.getField(fields.TRELLO_ID)) {
            return requester.updateCardMain(task.getField(fields.TRELLO_ID), this.mainToRaw(task))
                .catch(
                    reason => {
                        if (reason.statusCode === 404) {
                            console.log(`Updating card '${task.getField(fields.NAME)}' failed. Creating new card`);

                            return this.createCard(task);
                        }
                    })
        } else {
            return this.createCard(task);
        }
    }

    /**
     * Attempts to match a task by either trello id or google id (prioritising trello id).
     *
     * @param task {Task} The task to match with
     * @param data {RawTrello} The data to match with
     * @return {Boolean} True if the data and the task match, False otherwise
     */
    doesTaskMatchData(task, data) {
        let googleId = this.getCustomFieldFromData(customFields.googleId, data);
        return task.getField(fields.TRELLO_ID) === data["id"]
            || (googleId && task.getField(fields.GOOGLE_ID) === googleId);
    }

    /**
     * Extracts the value in a field from a custom field
     * @param fieldId The id of the custom field
     * @param data {RawTrello} The data for the card with the field
     * @return {boolean|""|number|undefined} The value of the field. undefined otherwise
     */
    getCustomFieldFromData(fieldId, data) {
        if ("customFieldItems" in data) {
            let field = data.customFieldItems.find(checkField => checkField.idCustomField === fieldId);
            if (field) {
                if ("checked" in field.value) {
                    return field.value.checked === 'true';
                } else if ("number" in field.value) {
                    parseInt(field.value.number);
                } else if ("text" in field.value) {
                    return field.value.text;
                } else {
                    throw new TypeError(`Custom field contains unknown value type: ${field}`);
                }
            } else {
                return undefined;
            }
        } else {
            return undefined;
        }
    }

    /**
     * Extract the categories contained within the card into a task format
     *
     * @param rawCard {RawTrello} The raw card data
     * @return {[number]} The categories the card is in
     */
    parseCategories(rawCard) {
        let taskCategories = new Set();
        // Firstly get the categories from the list it's in
        let listId = Object.keys(categoryLists).find(key => categoryLists[key] === rawCard.idList);
        if (listId !== undefined) {
            taskCategories.add(parseInt(listId));
        }

        if (this.getCustomFieldFromData(customFields.isDesign, rawCard)) {
            taskCategories.add(categories.DESIGN)
        }
        if (this.getCustomFieldFromData(customFields.isCode, rawCard)) {
            taskCategories.add(categories.CODING)
        }
        if (this.getCustomFieldFromData(customFields.isDocs, rawCard)) {
            taskCategories.add(categories.DOCS_TRAINING)
        }
        if (this.getCustomFieldFromData(customFields.isOutResearch, rawCard)) {
            taskCategories.add(categories.OUTRESEARCH)
        }
        if (this.getCustomFieldFromData(customFields.isQa, rawCard)) {
            taskCategories.add(categories.QA)
        }
        return [...taskCategories];
    }

    /**
     * Convert from the tags in the card into the task format
     * @param rawCard {RawTrello} The raw data to extract from
     * @return {string[]} The tags on this task
     */
    parseTags(rawCard) {
        let tagString = this.getCustomFieldFromData(customFields.tags, rawCard);
        if (tagString !== undefined && tagString !== "") {
            return tagString.split(/,/).map(str => str.trim())
        } else {
            return [];
        }
    }

    /**
     *  Overwrite a task with the given data.
     *
     *  The field is only overwritten following the rules given in {@link ApiInterface#loadAllTasks()}
     *
     * @param rawCard {RawTrello} The data to write in
     * @param task {Task} The task to overwrite
     */
    loadIntoTask(rawCard, task) {
        task.setIfData(fields.TRELLO_ID, rawCard.id);
        task.setIfData(fields.DESCRIPTION, rawCard.desc);
        task.setIfData(fields.NAME, rawCard.name);

        task.setIfData(fields.GOOGLE_ID, this.getCustomFieldFromData(customFields.googleId, rawCard));
        task.setIfData(fields.DAYS, this.getCustomFieldFromData(customFields.days, rawCard));
        task.setIfData(fields.IS_BEGINNER, this.getCustomFieldFromData(customFields.isBeginner, rawCard));
        task.setIfData(fields.MAX_INSTANCES, this.getCustomFieldFromData(customFields.instances, rawCard));

        this.parseCategories(task, rawCard);
        task.setIfData(fields.TAGS, this.parseTags(rawCard));

        // Not replicated
        // task.setIfData(fields.STATUS, null); Not stored on trello
        // task.setIfData(fields.MENTORS, null); Not stored on trello
        // task.setIfData(fields.EXTERNAL_URL, null); Not stored on trello

        //Read only
        task.setIfData(fields.LAST_MODIFIED, rawCard.dateLastActivity);
        // task.setIfData(fields.COMPLETED_COUNT, null); Not stored on trello
        // task.setIfData(fields.CLAIMED_COUNT, null); Not stored on trello
        // task.setIfData(fields.AVAILABLE_COUNT, null); Not stored on trello
    }


    /**
     * Converts a task into the main section of the raw data used by Trello
     * This is all the data except that contained within a custom field.
     *
     * @param task {Task} The task to convert
     * @return {RawTrello} The main raw data of the task
     */
    mainToRaw(task) {
        let rawMain = {};
        rawMain.id = task.getField(fields.TRELLO_ID);
        rawMain.desc = task.getField(fields.DESCRIPTION);
        rawMain.name = task.getField(fields.NAME);
        return rawMain;
    }

    /**
     * Converts data on the task into a custom field entry
     *
     * @param fieldId {string} The field on the task to convert
     * @param task {Task} The task to get the data from
     * @return {RawCustomField} The field in raw form
     */
    getCustomFieldFromTask(fieldId, task) {
        let val = task.getField(fieldId);
        switch (typeof val) {
            case 'boolean':
                return {value: {checked: val.toString()}};
            case 'string':
                return {value: {text: val.toString()}};
            case 'number':
                return {value: {number: val.toString()}};
            default:
                throw  TypeError("Unknown type for trello custom field: " + typeof val);
        }
    }

    /**
     * Convert the tags field on a task into valid format for the trello custom fields
     *
     * @param task {Task} The task to get the tags from
     * @return {RawCustomField} The tags in raw form
     */
    serialiseTags(task) {
        let tags = task.getField(fields.TAGS);
        return {value: {text: tags.join(", ")}};
    }

    /**
     * Convert the categories on a task into a valid format for Trello custom fields.
     * Due to the way categories are stored on trello vs GCI this is not a single custom field, hence the dict return type
     *
     * @param task {Task} The task to get the categories from
     * @return {Object.<string,RawCustomField>} The raw custom fields encoding the categories on the task
     */
    serialiseCategories(task) {
        let result = {};
        let taskCategories = task.getField(fields.CATEGORIES);
        result[customFields.isCode] = taskCategories.includes(categories.CODING) ? {value: {checked: "true"}} : {value: ""};
        result[customFields.isQa] = taskCategories.includes(categories.QA) ? {value: {checked: "true"}} : {value: ""};
        result[customFields.isOutResearch] = taskCategories.includes(categories.OUTRESEARCH) ? {value: {checked: "true"}} : {value: ""};
        result[customFields.isDocs] = taskCategories.includes(categories.DOCS_TRAINING) ? {value: {checked: "true"}} : {value: ""};
        result[customFields.isDesign] = taskCategories.includes(categories.DESIGN) ? {value: {checked: "true"}} : {value: ""};
        return result;
    }

    /**
     * Converts all the custom fields on a task into their raw form
     *
     * @param task {Task} The task to convert
     * @return {Object.<string, RawCustomField>} The custom fields in raw form
     */
    customToRaw(task) {
        let rawCustom = this.serialiseCategories(task);
        rawCustom[customFields.tags] = this.serialiseTags(task);
        rawCustom[customFields.googleId] = this.getCustomFieldFromTask(fields.GOOGLE_ID, task);
        rawCustom[customFields.days] = this.getCustomFieldFromTask(fields.DAYS, task);
        rawCustom[customFields.isBeginner] = this.getCustomFieldFromTask(fields.IS_BEGINNER, task);
        rawCustom[customFields.instances] = this.getCustomFieldFromTask(fields.MAX_INSTANCES, task);
        return rawCustom;
    }
}

module.exports = new TrelloInterface();