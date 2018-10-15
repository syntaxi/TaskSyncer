"use strict";
const request = require('request');
const tokens = require('./tokens.json');

const categories = {
    CODING: 1,
    DESIGN: 2,
    DOCS_TRAINING: 3,
    QA: 4,
    OUTRESEARCH: 5
};

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
        this.days = 0;
        this.externalUrl = "";
        this.privateMetadata = "";

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
        if (this.googleId && this.trelloId) {

        }
    }

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

        //TODO: Use this for trello id
        this.private_metadata = data.private_metadata;

        this.crosslinkIds()
    }

    loadFromTrello(data) {
        this.trelloId = data.id;
        this.description = data.desc;
        this.name = data.name;

        requester.getCustomFields(this.trelloId,
            (data) => {
                data.customFieldItems.forEach(this.handleField, this);
            }, this);

        this.crosslinkIds()
    }

    handleField(field) {
        switch (field.idCustomField) {
            case this.customFields.isBeginner:
                this.isBeginner = field.value.checked === "true";
                break;
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
                this.googleId = field.value.number;
                break;
            case this.customFields.isCode:
                if (field.value.checked === "true") {
                    this.categories[categories.CODING] = true
                }
                break;
            case this.customFields.isDesign:
                if (field.value.checked === "true") {
                    this.categories[categories.DESIGN] = true
                }
                break;
            case this.customFields.isDocs:
                if (field.value.checked === "true") {
                    this.categories[categories.DOCS_TRAINING] = true
                }
                break;
            case this.customFields.isOutResearch:
                if (field.value.checked === "true") {
                    this.categories[categories.OUTRESEARCH] = true
                }
                break;
            case this.customFields.isQa:
                if (field.value.checked === "true") {
                    this.categories[categories.QA] = true
                }
                break;
            default:
                console.error(`Unknown field type '${field.id}' on card ${this.name}`);
        }
    }
}

class TaskList {
    constructor() {
        this.tasks = [];
        this.boardId = "5b9b100cca1728134ee88b15";
        this.categoryLists = {
            1: '5bb10eaaa163492c93420393',
            2: '5bb13fe396623c2292321640',
            3: '5bb13feff9698564f44ccc4b',
            4: '5bb13ffda245836ef12b392c',
            5: '5bb1400605e0cc6f01a9e124',
        };
    }

    getTaskFromGoogle(id) {
        /* Find index */
        let index = this.tasks.findIndex((data) => {
            return data.googleId === id
        });
        /* Make new task if one doesn't exist */
        if (index === -1) {
            this.tasks.push(new Task());
            index = this.tasks.length - 1;
        }
        return this.tasks[index];
    }

    getTaskFromTrello(id) {
        /* Find index */
        let index = this.tasks.findIndex((data) => {
            return data.trelloId === id
        });
        /* Make new task if one doesn't exist */
        if (index === -1) {
            this.tasks.push(new Task());
            index = this.tasks.length - 1;
        }
        return this.tasks[index];
    }

    loadFromGoogle(page) {
        page = page || 1;
        console.log(`Requesting page ${page} from google`);
        requester.googleGet('tasks', 'page=1', (body) => {
            taskList._loadFromGoogle(body);
            if (body['next'] != null) {
                this.loadFromGoogle(body.next);
            }
        }, this);
    }

    _loadFromGoogle(data) {
        data.results.forEach((taskData) => this.getTaskFromGoogle(taskData.id).loadFromGoogle(taskData))
    }

    loadFromTrello() {
        for (let category in categories) {
            console.log(`Requesting ${category.toLowerCase()} list from Trello`);

            requester.getListCards(this.categoryLists[categories[category]], this._loadFromTrello, this);
        }
    }

    _loadFromTrello(data) {
        data.forEach((item) => this.getTaskFromTrello(item.id).loadFromTrello(item));
    }
}

class ApiRequester {
    constructor(googleToken, trelloKey, trelloToken) {
        this.googleToken = googleToken;
        this.trelloKey = trelloKey;
        this.trelloToken = trelloToken;
    }

    getListCards(id, callback, thisArg) {
        this.trelloGet(`lists/${id}/cards`, null, callback, thisArg)
    }

    getCustomFields(card, callback, thisArg) {
        this.trelloGet(`cards/${card}`, "&customFieldItems=true", callback, thisArg)
    }

    trelloGet(path, queryArg, callback, thisArg) {
        request({
            method: `GET`,
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${queryArg || ""}`
        }, (error, response, body) => {
            if (response.statusCode === 200) {
                callback.call(thisArg, JSON.parse(body));
            } else {
                console.error(`Response: ${response.statusCode},\n\t${body}`);
            }
        });
    }

    googleGet(item, queryArg, callback, thisArg) {
        request({
            method: 'GET',
            uri: `https://codein.withgoogle.com/api/program/current/${item}/${queryArg ? "?" : ""}${queryArg}`,
            auth: {
                'bearer': this.googleToken
            }

        }, (error, response, body) => {
            if (response.statusCode === 200) {
                callback.call(thisArg, JSON.parse(body));
            } else {
                console.error(`Response: ${response.statusCode},\n\t${body}`);
            }
        });
    }

    setCustomField(card, field, type, value) {
        let data = {value:{}};
        data.value[type] = value;
        this.trelloPut(`/card/${card}/customField/${field}/item`, data)
    }

    trelloPut(path, data) {
        request({
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${queryArg || ""}`
        }, (error, response, body) => {
            if (response.statusCode !== 200) {
                console.error(`Response: ${response.statusCode},\n\t${body}`);
            }
        });
    }
}


const requester = new ApiRequester(tokens.googleToken,
    tokens.trelloKey,
    tokens.trelloToken);
const taskList = new TaskList(requester);

taskList.loadFromGoogle();