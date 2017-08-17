'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const http = require('http');
const PassThrough = require('stream').PassThrough;

const Jira = require('../lib/jira');


describe('Jira API', function() {
    beforeEach(function() {

        this.request = sinon.stub(http, 'request');
    
        this.jira = new Jira({
            hostname: 'localhost',
            basicAuthEncodedString: 'test',
        })    
    });

    afterEach(function() {
        http.request.restore();
    });

    it('Finds an issue', function() {
       let expected = {
            errorMessages: [
                "Issue does not exist or you do not have permission to see it."
            ],
            errors: { }
        };
        let response = new PassThrough();
        response.write(JSON.stringify(expected));
        response.end();

        let request = new PassThrough();
        this.request.callsArgWith(1, response)
	            .returns(request);

        this.jira.getIssue('WE-44').then(rawData => {
            //assert.deepEqual(result, expected);


        });
    })
});