class SiteMonitor {

    /**
     * @type {TaskList} The list to monitor
     */
    monitoredList;

    /**
     * @type MonitorCallback
     */
    createdCallback;
    /**
     * @type MonitorCallback
     */
    deletedCallback;
    /**
     * @type MonitorCallback
     */
    alteredCallback;

    /**
     *
     * @param created {MonitorCallback}
     * @param deleted {MonitorCallback}
     * @param altered {MonitorCallback}
     */
    setMonitorCallbacks(created, deleted, altered) {
        this.createdCallback = created;
        this.deletedCallback = deleted;
        this.alteredCallback = altered;
    }

    /**
     *
     * @param taskList {TaskList}
     */
    setupMonitoring(taskList) {
        throw new Error("Method not implemented");
    }
}

module.exports = new SiteMonitor();