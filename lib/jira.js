/* eslint-env node, es6 */

// TODO: add full jsdocs annotation

'use strict';

var protocolAdapters = {
	http: require('http')
	, https: require('https')
}
/**
 * Jira Class
 *
 * @class
 */
class Jira {
	/**
	 * @param Object options
	 * @constructor
	 */
	constructor(options) {
		this.protocol = options.protocol || 'https'
		this.hostname = options.hostname
		this.apiVersion = options.apiVersion || 'latest'
		this.base = options.base || ''
		this.strictSSL = options.hasOwnProperty('strictSSL') ? options.strictSSL : true;
		this.followAllRedirects = options.followAllRedirects || true;
		this.headers = {
			'Content-Type': 'application/json'
		};
		this.logPrefix = options.logPrefix || 'Jira API :: ';
		this.issuePattern = options.issuePattern || /([a-zA-Z][a-zA-Z0-9_]+-[1-9][0-9]*)/gi;

		if (options.username && options.password) {
			options.basicAuthEncodedString = Buffer.from(`${options.username}:${options.password}`).toString('base64');
		}

		if(options.basicAuthEncodedString) {
			this.headers['Authorization'] = `Basic ${options.basicAuthEncodedString}`;
		}

	}

	/**
	 * Build the request object
	 *
	 * @param {object} options
	 * @return {object}
	 */
	buildRequest(options = {}) {
		let baseOptions = {
			hostname: this.hostname
			, path: `${this.base}/rest/api/${this.apiVersion}${options.path}`
			, headers: this.headers
			, followAllRedirects: this.followAllRedirects
		}

		// TODO: not sure if this is quite right - could end up with objects with props not required
		return Object.assign(options, baseOptions);
	}

	/**
	 * Perform the request
	 *
	 * @param {object} request
	 * @param {object} body
	 * @return Promise
	 */
	doRequest(request, body = {}) {

		console.log(request);

		return new Promise((resolve, reject) => {

			var req = protocolAdapters[this.protocol].request(request, (res) => {
				let rawData = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => rawData += chunk);
				res.on('end', () => resolve(rawData));
			}).on('error', (e) => {
				reject(`Got error: ${e.message}`)
			});

			if(Object.keys(body).length > 0 && body.constructor === Object && request.method !== 'GET') {
				req.write(JSON.stringify(body));
			}

			req.end();
		});
	}

	/**
	 * Update an issue
	 *
	 * @param String issue
	 * @param String update
	 * @return Promise
	 */
	updateIssue(issue, update) {
		return this.doRequest(this.buildRequest({
			path: `/issue/${issue}`
			, method: 'PUT'
		}), update);
	}

	/**
	 * Get an issue
	 *
	 * @param {object} request
	 * @param String tree
	 * @return Promise
	 */
	getIssue(issue, tree = '', expand = '', orderBy = '') {
		var queryStr = '?';

		console.log(`${this.logPrefix} Fetching ${issue} ${tree}`);

		if(expand !== '') {
			queryStr = `${queryStr}expand=${expand}`;
		}

		if(orderBy !== '') {
			queryStr = `${queryStr}&orderBy=${orderBy}`;
		}

		return this.doRequest(this.buildRequest({
			path: `/issue/${issue}/${tree}${queryStr}`
		}));
	}

	/**
	 * Add a comment
	 *
	 * @param String issue
	 * @param String comment
	 * @param String visibleTo
	 * @return Promise
	 */
	comment(issue, comment, visibleTo = '', visibleType = 'role') {
		let update = {
			update: {
				comment: [{
					add: {
						body: comment
					}
				}]
			}
		}
		, log = `${this.logPrefix} Adding comment "${comment}" to ${issue}`;

		if(visibleTo !== '') {
			update.update.comment[0].add.visibility = {
				type: visibleType
				, value: visibleTo
			}

			log += ` for ${visibleTo}`;
		}

		console.log(log);

		return this.updateIssue(issue, update);
	}

	/**
	 * Assign an issue
	 *
	 * @param String issue
	 * @param String assignee
	 * @return Promise
	 */
	assign(issue, assignee) {

		console.log(`${this.logPrefix} Assigning ${issue} to ${assignee}`);

		return this.updateIssue(issue, {
			fields: {
				assignee: {
					name: assignee
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
		let request = this.buildRequest({
			path: `/issue/${issue}/transitions`
			, method: 'POST'
		});

		// Get available transitions


		// Check specified is available
			// Get the ID

			// Move the issue
	}

	/**
	 * Get an issue's comments
	 *
	 * @param String issue
	 * @return Promise
	 */
	getComments(issue) {
		return this.getIssue(issue, 'comment');
	}

	/**
	 * Return an Object of issue matches from a string
	 *
	 * @param String string
	 * @return Object
	 */
	matchIssues(string) {
		let issues = {};

		// Get array of issue matches from commit comment
		let matches = string.match(this.issuePattern);

		if (matches) {
			for (let match of matches) {
				// Create map of projects/issues key/values
				let projectKey = match.substring(0, match.indexOf('-'));

				if (typeof issues[projectKey] === 'undefined') {
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
	 * @param String project
	 * @param String fixVersion
	 * @return Promise
	 */
	getFixVersionId(project, fixVersion) {
		//TODO error handling
		return this.doRequest(this.buildRequest({
			path: `/project/${project}/versions`
		})).then(rawData => {
			let json = JSON.parse(rawData);

			return json.filter(fixVersionObj => {
				return fixVersionObj.name === fixVersion
			})[0].id;
		});
	}

	/**
	 * Get issues in a project's fix version
	 *
	 * @param String string
	 * @return Object
	 */
	getIssuesInFixVersion(project, fixVersion) {

		// TODO error handling

		return this.getFixVersionId(project, fixVersion)
			.then(fixVersionId => {
				let jql = encodeURIComponent(`project=${project} and fixVersion=${fixVersionId}`)

				return this.doRequest(this.buildRequest({
					path: `/search?jql=${jql}&fields=key&maxResults=-1`
				}));
			}).then(rawData => {
				let json = JSON.parse(rawData);

				return json.issues.map(issue => issue.key);
			});
	}

	getIssueHistory(issue, filter = '') {
		// get issue

		// get histories

		// sort by timestamp

		// return
	}

	getTimeInStatuses(issue) {
		// getIssueHistory

		// 


	}
}

module.exports = Jira;
