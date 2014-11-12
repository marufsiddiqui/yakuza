/**
* @author Rafael Vidaurre
* @module Job
*/

'use strict';

var _ = require('lodash');
var Events = require('eventemitter2').EventEmitter2;

/**
* @class
* @param {string} uid Unique identifier for the job instance
* @param {Scraper} scraper Reference to the scraper being used by the job
* @param {Agent} agent Reference to the agent being used by the job
*/
function Job (uid, scraper, agent) {

  /**
  * Whether the job has started or not
  * @private
  */
  this._started = false;

  /**
  * Configuration for _events property
  * @private
  */
  this._eventsConfig = {
    wildcard: true
  };

  /**
  * EventEmitter2 instance which is encharge of handling events for a job
  * @private
  */
  this._events = new Events(this._eventsConfig);

  /**
  * Current execution plan group idx from which we will build the next execution queue
  * @private
  */
  this._planIdx = -1;

  /**
  * Current execution queue group idx to run
  * @private
  */
  this._executionQueueIdx = -1;

  /**
  * Parameters that will be provided to the Task instances
  * @private
  */
  this._params = {};

  /**
  * Tasks enqueued via Job's API
  * @private
  */
  this._enqueuedTasks = [];

  /**
  * Represents enqueued tasks' sincrony and execution order
  * @private
  */
  this._plan = null;

  /**
  * Queue of tasks built in runtime defined by taskDefinition builders and execution plan
  * @private
  */
  this._executionQueue = [];

  /** Reference to the Agent instance being used by the Job */
  this._agent = agent;

  /** Reference to the Scraper instance being used by the Job */
  this._scraper = scraper;

  /** Unique Job identifier */
  this.uid = null;

  // Set job's uid
  if (uid !== undefined) this._setUid(uid);

  // Set event listeners
  this._setEventListeners();
}

/**
* Sets the Jobs Uid value
* @param {string} argUid Uid which uniquely identifies the job
* @private
*/
Job.prototype._setUid = function (argUid) {
  if (!argUid || !_.isString(argUid) || argUid.length <= 0) {
    throw new Error('Job uid must be a valid string');
  }
  this.uid = argUid;
};

/**
* Prepares execution groups to run based on plan and enqueued tasks
* @private
*/
Job.prototype._applyPlan = function () {
  var _this = this;
  var executionPlan, nextGroupIdx, newExecutionPlan, newTaskGroup, matchIdx, groupTaskIds;

  executionPlan = this._agent._plan;
  newExecutionPlan = [];
  newTaskGroup = [];

  _.each(executionPlan, function (executionGroup) {
    groupTaskIds = _.map(executionGroup, function (taskObj) {
      return taskObj.taskId;
    });

    _.each(_this._enqueuedTasks, function (enqueuedTask) {
      matchIdx = groupTaskIds.indexOf(enqueuedTask);
      if (matchIdx >= 0) {
        newTaskGroup.push(executionGroup[matchIdx]);
      }
    });

    if (newTaskGroup.length > 0) {
      newExecutionPlan.push(newTaskGroup);
      newTaskGroup = [];
    }
  });

  this._plan = newExecutionPlan;
};

/**
* Returns an undefined number of Task instances based on a taskDefinition's builder output
* @param {object} taskSpecs contains specifications to build a certain Task via it's TaskDefinition
* @private
* @return {array} an array of Tasks
*/
Job.prototype._buildTask = function (taskSpecs) {
  var errMsg, taskDefinition;

  taskDefinition = this._agent._taskDefinitions[taskSpecs.taskId];
  errMsg = 'Task with id ' + taskSpecs.taskId + ' does not exist in agent ' + this._agent.id;

  if (taskDefinition === undefined) throw new Error(errMsg);

  return taskDefinition._build();
};

/**
* Takes a plan group and creates the next execution block to be inserted into the execution
* queue
* @param {array} array of objects which represent tasks methods in a plan
* @private
* @return {array} array of objects which contain Task instances with their execution data
* @example
* // Input example
* [{taskId: 1, sync: true}, {taskId: 2}, {taskId: 3}]
* // Output
* // [{task: <taskInstance>, next: {...}}, {task: <taskInstance>, next: null}]
*/
Job.prototype._buildExecutionBlock = function (planGroup) {
  var _this = this;
  var executionBlock, executionObject, tasks, previousObject;

  executionBlock = [];

  _.each(planGroup, function (taskSpecs) {
    tasks = _this._buildTask(taskSpecs);
    previousObject = null;

    // Build all execution objects for a specific task and
    _.each(tasks, function (task) {
      executionObject = {task: task, next: null};

      // Assign new object to previous object's `next` attribute if the task is self syncronous
      if (taskSpecs.selfSync) {
        if (previousObject) {
          previousObject.next = executionObject;
          previousObject = executionObject;
        } else {
          previousObject = executionObject;
          executionBlock.push(executionObject);
        }
      } else {
        executionBlock.push(executionObject);
      }
    });
  });

  return executionBlock;
};

/**
* increments execution plan index, builds an execution block from it and pushes it to the execution
* queue. This does NOT increment the
* @fires eq:applyBlock
*/
Job.prototype._applyNextExecutionBlock = function () {
  var executionBlock;

  this._planIdx += 1;
  executionBlock = Job.prototype._buildExecutionBlock(this._plan[this._planIdx]);
  this._executionQueue.push(executionBlock);

  this._events.emit('eq:applyBlock');
};

/**
* Triggers the agent's applySetupFunction
*/
Job.prototype._applyAgentSetup = function () {
  this._agent._applySetup();
};

/**
* Does necessary stuff needed before running can occur
*/
Job.prototype._prepareRun = function () {
  this._applyAgentSetup();
  this._applyPlan();
};

/**
* Event handler called on event job:start
* @private
*/
Job.prototype._onJobStart = function () {
  this._prepareRun();
  this._applyNextExecutionBlock();
};

Job.prototype._onEqApplyBlock = function () {

};

/**
* Sets all the job's event listeners
* @private
*/
Job.prototype._setEventListeners = function () {
  var _this = this;

  this._events.once('job:start', function () {
    _this._onJobStart();
  });

  this._events.on('eq:applyBlock', function () {
    _this._onEqApplyBlock();
  });
};

/**
* Sets parameters which the job will provide to its tasks
* @param {object} paramsObj Object containing key-value pair
*/
Job.prototype.params = function (paramsObj) {
  if (_.isArray(paramsObj) || !_.isObject(paramsObj)) throw Error('Params must be an object');

  _.extend(this._params, paramsObj);

  return this;
};

/**
* Adds a taskDefinition to be run by Job.prototype job
* @param {string} taskId Id of the taskDefinition to be run
*/
Job.prototype.enqueue = function (taskId) {
  if (!_.isString(taskId) || taskId.length <= 0) {
    throw Error('Enqueue params isn\'t a valid string');
  }

  this._enqueuedTasks.push(taskId);

  return this;
};

/**
* Begin the scraping job
* @fires job:start
*/
Job.prototype.run = function () {
  if (this._started) return;

  this._started = true;

  this._events.emit('job:start');
};


module.exports = Job;
