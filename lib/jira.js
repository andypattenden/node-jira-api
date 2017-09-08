/* eslint-env node, es6 */

"use strict";

const Moment = require("moment");
const MomentRange = require("moment-range");
const moment = MomentRange.extendMoment(Moment);

// TODO: add full jsdocs annotation

var protocolAdapters = {
  http: require("http"),
  https: require("https")
};
/**
 * Jira Class
 *
 * @class
 */
class Jira {
  /**
	 * @param {Object} options
	 * @constructor
	 */
  constructor(options) {
    this.protocol = options.protocol || "https";
    this.hostname = options.hostname;
    this.apiVersion = options.apiVersion || "latest";
    this.base = options.base || "";
    this.strictSSL = options.hasOwnProperty("strictSSL")
      ? options.strictSSL
      : true;
    this.followAllRedirects = options.followAllRedirects || true;
    this.headers = {
      "Content-Type": "application/json"
    };
    this.logPrefix = options.logPrefix || "Jira API :: ";
    this.issuePattern =
      options.issuePattern || /([a-zA-Z][a-zA-Z0-9_]+-[1-9][0-9]*)/gi;

    if (options.username && options.password) {
      options.basicAuthEncodedString = Buffer.from(
        `${options.username}:${options.password}`
      ).toString("base64");
    }

    if (options.basicAuthEncodedString) {
      this.headers["Authorization"] = `Basic ${options.basicAuthEncodedString}`;
    }
  }

  /**
	 * Build the request object
	 *
	 * @param {Object} options
	 * @return {Object}
	 */
  _buildRequest(options = {}) {
    let baseOptions = {
      hostname: this.hostname,
      path: `${this.base}/rest/api/${this.apiVersion}${options.path}`,
      headers: this.headers,
      followAllRedirects: this.followAllRedirects
    };

    // TODO: not sure if this is quite right - could end up with objects with props not required
    return Object.assign(options, baseOptions);
  }

  /**
	 * Perform the request
	 *
	 * @param {Object} request
	 * @param {Object} [body]
	 * @return {Promise}
	 */
  _doRequest(request, body = {}) {
    //console.log(request);

    return new Promise((resolve, reject) => {
      var req = protocolAdapters[this.protocol]
        .request(request, res => {
          let rawData = "";
          res.setEncoding("utf8");
          res.on("data", chunk => (rawData += chunk));
          res.on("end", () => {
            if (res.statusCode === 204) {
              resolve("Success");
            }

            try {
              let json = JSON.parse(rawData);

              if (
                typeof json.errorMessages !== "undefined" &&
                json.errorMessages.length > 0
              ) {
                reject(`Error: ${json.errorMessages}`);
              }

              if (
                typeof json.errors !== "undefined" &&
                Object.keys(json.errors).length > 0
              ) {
                reject(`Error: ${JSON.stringify(json.errors)}`);
              }

              resolve(JSON.parse(rawData));
            } catch (e) {
              reject(`Got error: ${e.message}`);
            }
          });
        })
        .on("error", e => {
          reject(`Got error: ${e.message}`);
        });

      if (
        Object.keys(body).length > 0 &&
        body.constructor === Object &&
        request.method !== "GET"
      ) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
	 * Update an issue
	 *
	 * @param {string} issue - the issue ID to update
	 * @param {string} update - the update to apply
	 * @return {Promise}
	 */
  updateIssue(issue, update) {
    return this._doRequest(
      this._buildRequest({
        path: `/issue/${issue}`,
        method: "PUT"
      }),
      update
    );
  }

  /**
	 * Get an issue
	 *
	 * @param {string} issue - the issue to fetch
	 * @param {string} [tree] - the specific information to fetch
	 * @param {string} [expand] - the fields within the tree to expand
	 * @param {string} [orderBy] - field to order info by
	 * @return {Promise}
	 */
  getIssue(issue, tree = "", expand = "", orderBy = "") {
    var queryStr = "?";

    console.log(`${this.logPrefix} Fetching ${issue} ${tree}`);

    if (expand !== "") {
      queryStr = `${queryStr}expand=${expand}`;
    }

    if (orderBy !== "") {
      queryStr = `${queryStr}&orderBy=${orderBy}`;
    }

    return this._doRequest(
      this._buildRequest({
        path: `/issue/${issue}/${tree}${queryStr}`
      })
    );
  }

  /**
	 * Add a comment
	 *
	 * @param {string} issue - the issue to add comment to
	 * @param {string} comment - comment to be added to issue
	 * @param {string} [visibleTo] - who the comment should be visible to
	 * @param {string} [visibleType] - type of visibility restriction
	 * @return {Promise}
	 */
  comment(issue, comment, visibleTo = "", visibleType = "role") {
    let update = {
        update: {
          comment: [
            {
              add: {
                body: comment
              }
            }
          ]
        }
      },
      log = `${this.logPrefix} Adding comment "${comment}" to ${issue}`;

    if (visibleTo !== "") {
      update.update.comment[0].add.visibility = {
        type: visibleType,
        value: visibleTo
      };

      log += ` for ${visibleTo}`;
    }

    console.log(log);

    return this.updateIssue(issue, update);
  }

  /**
	 * Assign an issue
	 *
	 * @param {string} issue - issue to be assigned
	 * @param {string} assigneeId - user id of assignee
	 * @return {Promise}
	 */
  assign(issue, assigneeId) {
    console.log(`${this.logPrefix} Assigning ${issue} to ${assigneeId}`);

    return this.updateIssue(issue, {
      fields: {
        assignee: {
          name: assigneeId
        }
      }
    });
  }

  /**
	 * TODO: Transition an issue
	 *
	 * @param String issue
	 * @param String transition
	 * @return Promise
	 */
  transition(issue, transition) {
    let request = this._buildRequest({
      path: `/issue/${issue}/transitions`,
      method: "POST"
    });

    // Get available transitions

    // Check specified is available
    // Get the ID

    // Move the issue
  }

  /**
	 * Get an issue's comments
	 *
	 * @param {string} issue - the issue to retrieve comments for
	 * @return {Promise}
	 */
  getComments(issue) {
    return this.getIssue(issue, "comment");
  }

  /**
	 * Return an Object of issue matches from a string
	 *
	 * @param {string} string - string to match issue pattern against
	 * @return {Object} - object containing matches
	 */
  matchIssues(string) {
    let issues = {};

    // Get array of issue matches from commit comment
    let matches = string.match(this.issuePattern);

    if (matches) {
      for (let match of matches) {
        // Create map of projects/issues key/values
        let projectKey = match.substring(0, match.indexOf("-"));

        if (typeof issues[projectKey] === "undefined") {
          issues[projectKey] = new Set();
        }

        // Add to existing set of issues using deconstruction
        issues[projectKey] = new Set([...issues[projectKey], match]);
      }
    }

    return issues;
  }

  /**
	 * Get the fix version id from its name
	 *
	 * @param {string} project - project to get fix version's ID from
	 * @param {string} fixVersion - fix version to fetch ID for
	 * @return {Promise}
	 */
  getFixVersionId(project, fixVersion) {
    return this._doRequest(
      this._buildRequest({
        path: `/project/${project}/versions`
      })
    ).then(
      json => {
        try {
          return json.filter(fixVersionObj => {
            return fixVersionObj.name === fixVersion;
          })[0].id;
        } catch (e) {
          throw new Error(`Fix version with ID '${fixVersion}' not found`);
        }
      },
      error => console.log(error)
    );
  }

  /**
	 * Get issues in a project's fix version
	 *
	 * @param {string} project - the project to fetch all fix versions for
	 * @return {Promise}
	 */
  getIssuesInFixVersion(project, fixVersion) {
    return this.getFixVersionId(project, fixVersion)
      .then(
        fixVersionId => {
          let jql = encodeURIComponent(
            `project=${project} and fixVersion=${fixVersionId}`
          );

          return this._doRequest(
            this._buildRequest({
              path: `/search?jql=${jql}&fields=key&maxResults=-1`
            })
          );
        },
        error => console.log(error)
      )
      .then(
        json => {
          return json.issues.map(issue => issue.key);
        },
        error => console.log(error)
      );
  }

  /**
	 * Get transition history of an issue
	 *
	 * @param {string} issue - issue to fetch transition history for
	 * @return {Promise}
	 */
  getIssueTransitionHistory(issue) {
    return this.getIssue(issue, "", "changelog", "created").then(
      json => {
        let transitions = [];

        // Build an array of transitions the ticket has been through
        for (let change of json.changelog.histories) {
          transitions = transitions.concat(
            change.items.reduce((a, item) => {
              if (item.field === "status") {
                a.push({
                  timestamp: moment(change.created),
                  from: item.fromString,
                  to: item.toString
                });
              }

              return a;
            }, [])
          );
        }

        // Sort the transitions in time order
        let statuses = transitions.sort((a, b) => {
          return a.timestamp - b.timestamp;
        });

        return new Promise(resolve => {
          resolve(statuses);
        });
      },
      error => console.log(error)
    );
  }

  /**
	 * Calculate status durations for issue
	 *
	 * @param {string} issue - issue to get status durations for
	 * @param {string} [unit] - unit to return durations as
	 * @param {boolean} [includeWeekends] - include weekends in durations
	 * @return {Promise}
	 */
  getStatusDurations(issue, unit = "seconds", includeWeekends = false) {
    return this.getIssueTransitionHistory(issue).then(
      transitions => {
        let statuses = transitions.map((transition, index, arr) => {
          // Calculates the duration between each transition

          let obj = {
            status: transition.to
          };

          let startTime = transition.timestamp.clone(); // clone so that we can manipulate without impacting other transitions

          // If we're not on the last transition
          if (index + 1 < arr.length) {
            // endTime is the timestamp of the next transition
            let endTime = arr[index + 1].timestamp.clone(); // clone so that we can manipulate without impacting other transitions

            // get dates between timestamps
            const range = moment.range(startTime, endTime);

            // get no of sat/sun in range so we can exclude if required
            // TODO: this assumes an entire weekend day has passed and a ticket has not transitioned part way through a day
            let weekendDaysInRange = 0;
            for (let day of range.by("day")) {
              if (day.day() === 0 || day.day() === 6) {
                weekendDaysInRange++;
              }
            }

            obj.daysCount = range.diff("days");
            obj.weekendDaysCount = weekendDaysInRange;
            obj.workingWeekdaysCount = obj.daysCount - obj.weekendDaysCount;

            if (!includeWeekends) {
              endTime.subtract(weekendDaysInRange, "days").diff(startTime);
            }

            obj.secondsInStatus = endTime.diff(startTime, "seconds");
          } else {
            obj.secondsInStatus = moment().diff(startTime, "seconds"); // time ticket has been in its last status
          }

          return obj;
        });

        // Build the object containing the issue details and all of its transitions
        let statusDurations = {};

        for (let status of statuses) {
          // If status already exists, add time to it
          if (statusDurations.hasOwnProperty(status.status)) {
            statusDurations[status.status] += status.secondsInStatus;
          } else {
            statusDurations[status.status] = status.secondsInStatus;
          }

          // convert to required unit
          statusDurations[status.status] = moment
            .duration(statusDurations[status.status], "seconds")
            .as(unit);
        }

        return statusDurations;
      },
      error => console.log(error)
    );
  }
}

module.exports = Jira;
