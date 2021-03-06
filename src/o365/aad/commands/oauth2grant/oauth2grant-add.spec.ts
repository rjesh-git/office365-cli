import commands from '../../commands';
import Command, { CommandOption, CommandValidate, CommandError } from '../../../../Command';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../AadAuth';
const command: Command = require('./oauth2grant-add');
import * as assert from 'assert';
import * as request from 'request-promise-native';
import Utils from '../../../../Utils';
import { Service } from '../../../../Auth';

describe(commands.OAUTH2GRANT_ADD, () => {
  let vorpal: Vorpal;
  let log: string[];
  let cmdInstance: any;
  let cmdInstanceLogSpy: sinon.SinonSpy;
  let trackEvent: any;
  let telemetry: any;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(auth, 'ensureAccessToken').callsFake(() => { return Promise.resolve('ABC'); });
    trackEvent = sinon.stub(appInsights, 'trackEvent').callsFake((t) => {
      telemetry = t;
    });
  });

  beforeEach(() => {
    vorpal = require('../../../../vorpal-init');
    log = [];
    cmdInstance = {
      log: (msg: string) => {
        log.push(msg);
      }
    };
    cmdInstanceLogSpy = sinon.spy(cmdInstance, 'log');
    auth.service = new Service('https://graph.windows.net');
    telemetry = null;
  });

  afterEach(() => {
    Utils.restore([
      vorpal.find,
      request.post
    ]);
  });

  after(() => {
    Utils.restore([
      appInsights.trackEvent,
      auth.ensureAccessToken,
      auth.restoreAuth
    ]);
  });

  it('has correct name', () => {
    assert.equal(command.name.startsWith(commands.OAUTH2GRANT_ADD), true);
  });

  it('has a description', () => {
    assert.notEqual(command.description, null);
  });

  it('calls telemetry', (done) => {
    cmdInstance.action = command.action();
    cmdInstance.action({ options: {} }, () => {
      try {
        assert(trackEvent.called);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('logs correct telemetry event', (done) => {
    cmdInstance.action = command.action();
    cmdInstance.action({ options: {} }, () => {
      try {
        assert.equal(telemetry.name, commands.OAUTH2GRANT_ADD);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('aborts when not logged in to AAD Graph', (done) => {
    auth.service = new Service('https://graph.windows.net');
    auth.service.connected = false;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Log in to Azure Active Directory Graph first')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('adds OAuth2 permission grant (debug)', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/myorganization/oauth2PermissionGrants?api-version=1.6`) > -1) {
        if (opts.headers.authorization &&
          opts.headers.authorization.indexOf('Bearer ') === 0 &&
          opts.headers['content-type'] &&
          opts.headers['content-type'].indexOf('application/json') === 0 &&
          opts.body.clientId === '6a7b1395-d313-4682-8ed4-65a6265a6320' &&
          opts.body.resourceId === '6a7b1395-d313-4682-8ed4-65a6265a6321' &&
          opts.body.scope === 'user_impersonation') {
          return Promise.resolve();
        }
      }

      return Promise.reject('Invalid request');
    });

    auth.service = new Service('https://graph.windows.net');
    auth.service.connected = true;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true, clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '6a7b1395-d313-4682-8ed4-65a6265a6321', scope: 'user_impersonation' } }, () => {
      try {
        assert(cmdInstanceLogSpy.calledWith(vorpal.chalk.green('DONE')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('adds OAuth2 permission grant', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/myorganization/oauth2PermissionGrants?api-version=1.6`) > -1) {
        if (opts.headers.authorization &&
          opts.headers.authorization.indexOf('Bearer ') === 0 &&
          opts.headers['content-type'] &&
          opts.headers['content-type'].indexOf('application/json') === 0 &&
          opts.body.clientId === '6a7b1395-d313-4682-8ed4-65a6265a6320' &&
          opts.body.resourceId === '6a7b1395-d313-4682-8ed4-65a6265a6321' &&
          opts.body.scope === 'user_impersonation') {
          return Promise.resolve();
        }
      }

      return Promise.reject('Invalid request');
    });

    auth.service = new Service('https://graph.windows.net');
    auth.service.connected = true;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: false, clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '6a7b1395-d313-4682-8ed4-65a6265a6321', scope: 'user_impersonation' } }, () => {
      try {
        assert(cmdInstanceLogSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly handles API OData error', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      return Promise.reject({
        error: {
          'odata.error': {
            code: '-1, InvalidOperationException',
            message: {
              value: 'An error has occurred'
            }
          }
        }
      });
    });

    auth.service = new Service('https://graph.windows.net');
    auth.service.connected = true;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: false, clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '6a7b1395-d313-4682-8ed4-65a6265a6320', scope: 'user_impersonation' } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('An error has occurred')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails validation if the clientId is not specified', () => {
    const actual = (command.validate() as CommandValidate)({ options: {} });
    assert.notEqual(actual, true);
  });

  it('fails validation if the clientId is not a valid GUID', () => {
    const actual = (command.validate() as CommandValidate)({ options: { clientId: '123' } });
    assert.notEqual(actual, true);
  });

  it('fails validation if the resourceId is not specified', () => {
    const actual = (command.validate() as CommandValidate)({ options: { clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320' } });
    assert.notEqual(actual, true);
  });

  it('fails validation if the resourceId is not a valid GUID', () => {
    const actual = (command.validate() as CommandValidate)({ options: { clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '123' } });
    assert.notEqual(actual, true);
  });

  it('fails validation if the scope is not specified', () => {
    const actual = (command.validate() as CommandValidate)({ options: { clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '6a7b1395-d313-4682-8ed4-65a6265a6320' } });
    assert.notEqual(actual, true);
  });

  it('passes validation when clientId, resourceId and scope are specified', () => {
    const actual = (command.validate() as CommandValidate)({ options: { clientId: '6a7b1395-d313-4682-8ed4-65a6265a6320', resourceId: '6a7b1395-d313-4682-8ed4-65a6265a6320', scope: 'user_impersonation' } });
    assert.equal(actual, true);
  });

  it('supports debug mode', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying clientId', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--clientId') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying resourceId', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--resourceId') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying scope', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--scope') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('has help referring to the right command', () => {
    const cmd: any = {
      log: (msg: string) => { },
      prompt: () => { },
      helpInformation: () => { }
    };
    const find = sinon.stub(vorpal, 'find').callsFake(() => cmd);
    cmd.help = command.help();
    cmd.help({}, () => { });
    assert(find.calledWith(commands.OAUTH2GRANT_ADD));
  });

  it('has help with examples', () => {
    const _log: string[] = [];
    const cmd: any = {
      log: (msg: string) => {
        _log.push(msg);
      },
      prompt: () => { },
      helpInformation: () => { }
    };
    sinon.stub(vorpal, 'find').callsFake(() => cmd);
    cmd.help = command.help();
    cmd.help({}, () => { });
    let containsExamples: boolean = false;
    _log.forEach(l => {
      if (l && l.indexOf('Examples:') > -1) {
        containsExamples = true;
      }
    });
    Utils.restore(vorpal.find);
    assert(containsExamples);
  });

  it('correctly handles lack of valid access token', (done) => {
    Utils.restore(auth.ensureAccessToken);
    sinon.stub(auth, 'ensureAccessToken').callsFake(() => { return Promise.reject(new Error('Error getting access token')); });
    auth.service = new Service('https://graph.windows.net');
    auth.service.connected = true;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Error getting access token')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
});