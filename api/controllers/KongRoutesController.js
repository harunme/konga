/**
 * SnapshotController
 *
 * @description :: Server-side logic for managing snapshots
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var _ = require("lodash");
var KongService = require('../services/KongService');

module.exports = _.merge(_.cloneDeep(require('../base/Controller')), {


  consumers: async (req,res) => {

    const routeId = req.params.id;
    let routeAclPlugin;
    let jwtPlugin;
    let basicAuthPlugin;
    let keyAuthPlugin;
    let hmacAuthPlugin;
    let oauth2Plugin;


    sails.log("KongRoutesController:consumers called");

    let plugins = await KongService.fetch(`/routes/${routeId}/plugins?enabled=true`, req);

    if(plugins.total == 0) return res.json([]);

    sails.log("Route plugins =>", plugins);

    routeAclPlugin = _.filter(plugins.data, item => item.name === 'acl')[0];
    jwtPlugin = _.filter(plugins.data, item => item.name === 'jwt-auth')[0];
    basicAuthPlugin = _.filter(plugins.data, item => item.name === 'basic-auth')[0];
    keyAuthPlugin = _.filter(plugins.data, item => item.name === 'key-auth')[0];
    hmacAuthPlugin = _.filter(plugins.data, item => item.name === 'hmac-auth')[0];
    oauth2Plugin = _.filter(plugins.data, item => item.name === 'oauth2')[0];

    sails.log("routeAclPlugin",routeAclPlugin)
    sails.log("jwtPlugin",jwtPlugin)
    sails.log("basicAuthPlugin",basicAuthPlugin)
    sails.log("keyAuthPlugin",keyAuthPlugin)
    sails.log("hmacAuthPlugin",hmacAuthPlugin)
    sails.log("oauth2Plugin",oauth2Plugin)

    let aclConsumerIds;

    let whiteListedGroups = routeAclPlugin ? routeAclPlugin.config.whitelist || [] : [];
    let blackListedGroups = routeAclPlugin ? routeAclPlugin.config.blacklist || [] : [];

    // ACL
    sails.log("whiteListedGroups",whiteListedGroups)
    sails.log("blackListedGroups",blackListedGroups)

    // We need to retrieve all acls and filter the accessible ones based on the whitelisted and blacklisted groups
    let acls = await KongService.fetch(`/acls`, req);

    sails.log("acls",acls);

    let filteredAcls = _.filter(acls.data, item => {
      return whiteListedGroups.indexOf(item.group) > -1 && blackListedGroups.indexOf(item.group) === -1;
    });

    sails.log("filteredAcls", filteredAcls);

    // Gather the consume ids of the filtered groups
    aclConsumerIds = _.map(filteredAcls, item => item.consumer_id);

    let jwts, keyAuths, hmacAuths, oauth2, basicAuths

    if(jwtPlugin) jwts = await KongService.fetch(`/jwts`, req);
    if(keyAuthPlugin) keyAuths = await KongService.fetch(`/key-auths`, req);
    if(hmacAuthPlugin) hmacAuths = await KongService.fetch(`/hmac-auths`, req);
    if(oauth2Plugin) oauth2 = await KongService.fetch(`/oauth2`, req);
    if(basicAuthPlugin) basicAuths = await KongService.fetch(`/basic-auths`, req);

    sails.log("jwts",jwts)
    sails.log("keyAuths",keyAuths)
    sails.log("hmacAuths",hmacAuths)
    sails.log("oauth2",oauth2)
    sails.log("basicAuths",basicAuths)


    let jwtConsumerIds = jwts ? _.map(jwts.data, item => item.consumer_id) : [];
    let keyAuthConsumerIds = keyAuths ? _.map(keyAuths.data, item => item.consumer_id) : [];
    let hmacAuthConsumerIds = hmacAuths ? _.map(hmacAuths.data, item => item.consumer_id) : [];
    let oauth2ConsumerIds = oauth2 ? _.map(oauth2.data, item => item.consumer_id) : [];
    let basicAuthConsumerIds = basicAuths ? _.map(basicAuths.data, item => item.consumer_id) : [];

    sails.log("jwtConsumerIds",jwtConsumerIds)
    sails.log("keyAuthConsumerIds",keyAuthConsumerIds)
    sails.log("hmacAuthConsumerIds",hmacAuthConsumerIds)
    sails.log("oauth2ConsumerIds",oauth2ConsumerIds)
    sails.log("basicAuthConsumerIds",basicAuthConsumerIds)

    let consumerIds;
    let authenticationPluginsConsumerIds = _.uniq([
      ...jwtConsumerIds,
      ...keyAuthConsumerIds,
      ...hmacAuthConsumerIds,
      ...oauth2ConsumerIds,
      ...basicAuthConsumerIds
    ]);

    if(aclConsumerIds) {
      sails.log("authenticationPluginsConsumerIds", authenticationPluginsConsumerIds);
      sails.log("aclConsumerIds", _.uniq(aclConsumerIds));
      consumerIds = authenticationPluginsConsumerIds.length ? _.intersection(_.uniq(aclConsumerIds), authenticationPluginsConsumerIds) : _.uniq(aclConsumerIds);
    }else{
      consumerIds = authenticationPluginsConsumerIds;
    }

    sails.log("consumerIds => ", consumerIds);

    // Fetch all consumers
    KongService.listAllCb(req, `/consumers`, (err, consumers) => {
      if (err) return res.negotiate(err);
      if(!consumers.data || !consumers.data.length) return res.json([]);

      let eligibleConsumers = _.filter(consumers.data, item => {
        return consumerIds.indexOf(item.id) > -1;
      })

      eligibleConsumers.forEach(consumer => {
        let plugins = [];
        if(keyAuths && _.filter(keyAuths.data,item => item.consumer_id === consumer.id).length) {
          plugins.push('key-auth')
        }
        if(jwts && _.filter(jwts.data,item => item.consumer_id === consumer.id).length) {
          plugins.push('jwt-auth')
        }
        if(hmacAuths && _.filter(hmacAuths.data,item => item.consumer_id === consumer.id).length) {
          plugins.push('hmac-auth')
        }
        if(oauth2 && _.filter(oauth2.data,item => item.consumer_id === consumer.id).length) {
          plugins.push('oauth2')
        }
        if(basicAuths && _.filter(basicAuths.data,item => item.consumer_id === consumer.id).length) {
          plugins.push('basic-auth')
        }
        consumer.plugins = plugins;

      })

      return res.json({
        total: eligibleConsumers.length,
        data: eligibleConsumers
      })

    })
  }

});

