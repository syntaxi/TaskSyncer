const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Task = require('./Task');
const Promise = require('bluebird');

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

    loadFromGoogle() {
        const outerList = this;
        /* Make a new promise */
        return new Promise(resolve => {

            /* This needs to be a nested function to have access to the resolve
             * And to be able to not make a new promise each recusion*/
            function innerRecurse(page) {
                console.log(`Requesting page ${page} from google`);
                /* Request the tasks */
                requester.googleGet('tasks', 'page=' + page)
                    .then(body => {
                        outerList._loadFromGoogle(body);
                        if (body.next != null) {
                            /* Recurse again if there are more pages */
                            innerRecurse(body.next);
                        } else {
                            /* Resolve the promise and stop if there are no more pages */
                            resolve();
                        }
                    });
            }

            innerRecurse(1);
        });
    }

    _loadFromGoogle(data) {
        data.results.forEach((taskData) => this.getTaskFromGoogle(taskData.id).loadFromGoogle(taskData))
    }

    loadFromTrello() {
        /**
         * Loads the data from all the trello lists
         *
         * Returns a promise that triggers when all the tasks are fully updated
         */

        const categoryPromises = [];
        for (let category in categories) {
            console.log(`Requesting ${category.toLowerCase()} list from Trello`);

            /* Make a call for the category, making a new promise to finish when all are done */
            categoryPromises.push(new Promise(resolve => {
                requester.getListCards(this.categoryLists[categories[category]])
                    .then((body) => {

                        /* Make calls for each field, storing the promises */
                        console.log(`Processing ${category.toLowerCase()}'s cards`);
                        const fieldPromises = [];
                        body.forEach((item) => fieldPromises.push(
                            this.getTaskFromTrello(item.id).loadFromTrello(item)));

                        /* Resolve the category promise when the fields are all done */
                        Promise.all(fieldPromises).then(() => resolve());
                    });
            }));
        }
        /* Return a promise that will finish when all the categories are done */
        return Promise.all(categoryPromises);
    }

    async writeToGoogle() {
        console.log("Writing to Google");
        const promises = [];
        for (let i = 0; i < this.tasks.length; i++) {
            const promise = await this.tasks[i].writeToGoogle();
            promises.push(promise);
        }
        return Promise.all(promises)
    }

    async writeToTrello() {
        console.log("Writing to Trello");
        const promises = [];
        for (let i = 0; i < this.tasks.length; i++) {
            const promise = await this.tasks[i].writeToTrello();
            promises.push(promise);
        }
        return Promise.all(promises)
    }
}

module.exports = new TaskList();