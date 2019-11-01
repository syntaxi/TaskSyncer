const requester = require("./TrelloApiRequester.js");
const {fields, categories} = require("./Globals");
const {categoryLists, customFields} = require("./config.json");
const ApiInterface = require("./ApiInterface.js");

class TrelloInterface extends ApiInterface {
    updateOtherId(task) {
        return requester.updateCustomField(
            task.getField(fields.TRELLO_ID),
            customFields.googleId,
            this.getCustomFieldFromTask(fields.GOOGLE_ID, task));
    }

    loadAllTasks(taskList) {
        return requester.getAllCards().then(rawCards => {
            for (let rawCard of rawCards) {
                let task = taskList.getOrMakeTask(task => this.doesTaskMatchData(task, rawCard));
                this.loadIntoTask(rawCard, task);
            }
            return taskList;
        });
    }

    doesTaskMatchData(task, data) {
        let googleId = this.getCustomFieldFromData(customFields.googleId, data);
        return task.getField(fields.TRELLO_ID) === data["id"]
            || (googleId && task.getField(fields.GOOGLE_ID) === googleId);
    }

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

    parseTags(rawCard) {
        let tagString = this.getCustomFieldFromData(customFields.tags, rawCard);
        if (tagString !== undefined && tagString !== "") {
            return tagString.split(/,/).map(str => str.trim())
        } else {
            return [];
        }
    }

    /**
     *
     * @param rawCard
     * @param task {Task}
     */
    loadIntoTask(rawCard, task) {
        task.setIfData(fields.TRELLO_ID, rawCard["id"]);
        task.setIfData(fields.DESCRIPTION, rawCard["desc"]);
        task.setIfData(fields.NAME, rawCard["name"]);

        task.setIfData(fields.GOOGLE_ID, this.getCustomFieldFromData(customFields.googleId, rawCard));
        task.setIfData(fields.DAYS, this.getCustomFieldFromData(customFields.days, rawCard));
        task.setIfData(fields.CATEGORIES, this.parseCategories(rawCard));
        task.setIfData(fields.IS_BEGINNER, this.getCustomFieldFromData(customFields.isBeginner, rawCard));
        task.setIfData(fields.TAGS, this.parseTags(rawCard));
        task.setIfData(fields.MAX_INSTANCES, this.getCustomFieldFromData(customFields.instances, rawCard));

        // Not replicated
        // task.setIfData(fields.STATUS, null); Not stored on trello
        // task.setIfData(fields.MENTORS, null); Not stored on trello
        // task.setIfData(fields.EXTERNAL_URL, null); Not stored on trello

        //Read only
        task.setIfData(fields.LAST_MODIFIED, rawCard["dateLastActivity"]);
        // task.setIfData(fields.COMPLETED_COUNT, null); Not stored on trello
        // task.setIfData(fields.CLAIMED_COUNT, null); Not stored on trello
        // task.setIfData(fields.AVAILABLE_COUNT, null); Not stored on trello
    }

    loadTask(task) {
        super.loadTask(task); //TODO: Implement
    }

    writeAllTasks(taskList) {
        return Promise.all(taskList.tasks.map(task => this.writeTask(task)));
    }

    /**
     *
     * @param task {Task}
     * @param rawMain
     * @return {Promise}
     */
    createCard(task, rawMain) {
        let cardCategories = task.getField(fields.CATEGORIES);
        let listId = categoryLists["1"]; //TODO replace this is a specific "no category list"
        if (cardCategories.length !== 0) {
            listId = categoryLists[cardCategories.pop().toString()];
        }

        delete rawMain["id"];
        rawMain["idList"] = listId;
        return requester.createCard(rawMain)
            .tap(response => task.setField(fields.TRELLO_ID, response["id"]));
    }

    /**
     *
     * @param task {Task}
     * @param rawMain
     * @return {Promise|Promise<T | never>}
     */
    writeOrCreate(task, rawMain) {
        if (task.getField(fields.TRELLO_ID)) {
            return requester.updateCardMain(task.getField(fields.TRELLO_ID), rawMain)
                .catch(
                    reason => {
                        if (reason.statusCode === 404) {
                            console.log(`Updating card '${task.getField(fields.NAME)}' failed. Creating new card`);

                            return this.createCard(task, rawMain);
                        }
                    })
        } else {
            return this.createCard(task, rawMain);
        }
    }

    async _updateAllFields(cardId, rawCustomFields) {
        for (let customFieldId in rawCustomFields) {
            if (rawCustomFields.hasOwnProperty(customFieldId)) {
                await requester.updateCustomField(cardId, customFieldId, rawCustomFields[customFieldId]);
            }
        }

    }

    writeTask(task) {
        task.resetUpdatedFields();
        let rawMain = this.mainToRaw(task);
        let rawCustomFields = this.customToRaw(task);
        return this.writeOrCreate(task, rawMain)
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
            });
    }

    /**
     *
     * @param task {Task}
     */
    mainToRaw(task) {
        let rawMain = {};
        rawMain["id"] = task.getField(fields.TRELLO_ID);
        rawMain["desc"] = task.getField(fields.DESCRIPTION);
        rawMain["name"] = task.getField(fields.NAME);
        return rawMain;
    }

    /**
     *
     * @param fieldId
     * @param task {Task}
     */
    getCustomFieldFromTask(fieldId, task) {
        let val = task.getField(fieldId);
        let data = {value: {}};
        switch (typeof val) {
            case 'boolean':
                data.value.checked = val.toString();
                break;
            case 'string':
                data.value.text = val.toString();
                break;
            case 'number':
                data.value.number = val.toString();
                break;
            default:
                throw  TypeError("Unknown type for trello custom field: " + typeof val);
        }
        return data;

    }

    /**
     *
     * @param task {Task}
     */
    serialiseTags(task) {
        let tags = task.getField(fields.TAGS);
        if (tags && tags.length !== 0) {
            return {value: {text: tags.join(", ")}};
        } else {
            return {value: {text: ""}};
        }
    }

    /**
     *
     * @param task {Task}
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