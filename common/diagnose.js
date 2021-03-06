#!/usr/bin/env node

var Netmask = require('netmask').Netmask,
    zone_list_networks = require('./guifi_api_client').zone_list_networks,
    node_search_by_ip = require('./guifi_api_client').node_search_by_ip,
    util = require("util");

function find_gateway(routes, req_route) {
    for (var item in routes) {
        var route = routes[item];
        if (route.dstaddress === req_route) {
            return route.gateway;
        }
    }
}

function checkroutes(zone_id, local_routes) {
    zone_list_networks(zone_id, function(guifi_routes) {
        console.log("Checking...");
        var i, bad_networks = {};
        for (i in local_routes) {
            var route = local_routes[i];
            var block = new Netmask(route.dstaddress);
            var network = util.format("%s/%s", block.base, block.bitmask);
            if (route.distance > 0 && route.distance < 255 && guifi_routes.indexOf(network) === -1) {

                var gateway = find_gateway(local_routes, network);
                if (bad_networks[gateway]) {
                    bad_networks[gateway].push(network);
                } else {
                    bad_networks[gateway] = [ network ];
                }
            }
        }

        for (var g in bad_networks) {
            node_search_by_ip(g, bad_networks[g], function(data) {
                if (data) {
                    for (var n in data.networks) {
                        console.log(util.format("The published OSPF network %s, coming from %s (%s) is not registered on guifi.net", data.networks[n], data.name, data.url));
                    }
                }
            });
        }

        var copia_routes = local_routes.slice();
        for (i in local_routes) {
            var route1 = local_routes[i];
            copia_routes.splice(local_routes.indexOf(route1), 1);
            var block1 = new Netmask(route1.dstaddress);
            var network1 = util.format("%s/%s", block1.base, block1.bitmask);
            for (var j in copia_routes) {
                var route2 = copia_routes[j];
                var block2 = new Netmask(route2.dstaddress);
                var network2 = util.format("%s/%s", block2.base, block2.bitmask);

                if (network1 !== network2 && (block2.contains(block1.first) || block1.contains(block2.first))) {
                   console.log(util.format("The published OSPF network %s overlaps with the published OSPF network %s", network1, network2));
                }
            }
        }
    });
}

function diagnose(ip, username, password, zone_id, method) {

    var getroutes;
    if (method === undefined) {
        getroutes = require("./mikrotik").getroutes;
    } else {
        getroutes = require(util.format("./%s", method)).getroutes;
    }

    getroutes(ip, username, password, zone_id, checkroutes);

}

module.exports = diagnose;
