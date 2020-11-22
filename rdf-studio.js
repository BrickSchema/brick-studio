var quadStore = N3.N3.Store();
var exportStore = N3.N3.Store();
var insertStore = N3.N3.Store();
var removeStore = N3.N3.Store();
var selfLinks = N3.N3.Store();
var prefixes = {};
var exportData = {};
exportData['rdf'] = {};
exportData['exports'] = {};
exportData['reduced'] = {};
var preferredRelationship = {};
var oldQuadsCount = {};
var autopilot = false;
var rdfString;
var writeString;
var format;
var writer = N3.N3.Writer();

class EventEmitter {

    constructor() {
        this.events = {};
    }

    _getEventListByName(eventName) {
        if (typeof this.events[eventName] === 'undefined') {
            this.events[eventName] = new Set();
        }
        return this.events[eventName]
    }

    on(eventName, fn) {
        this._getEventListByName(eventName).add(fn);
    }

    once(eventName, fn) {

        const self = this;

        const onceFn = function(...args) {
            self.removeListener(eventName, onceFn);
            fn.apply(self, args);
        };
        this.on(eventName, onceFn);

    }

    emit(eventName, ...args) {

        this._getEventListByName(eventName).forEach(function(fn) {

            fn.apply(this, args);

        }.bind(this));

    }

    removeListener(eventName, fn) {
        this._getEventListByName(eventName).delete(fn);
    }


}

var emitter = new EventEmitter();
var data = {
    nodes: [],
    links: [],
    uniqueTypes: new Set()
};
var nodeDepths = {};
var config = {
    excludePredicates: ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://brickschema.org/schema/1.0.1/BrickFrame#hasTag', 'http://www.w3.org/2000/01/rdf-schema#label', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#hasTag'],
    excludeTypes: ['http://www.w3.org/2002/07/owl#NamedIndividual', 'https://brickschema.org/schema/1.0.1/Brick#Point', 'http://www.w3.org/2002/07/owl#Class', 'https://brickschema.org/schema/1.0.1/BrickFrame#Label', 'https://brickschema.org/schema/1.0.1/BrickFrame#TagSet'],
    defined: {
        objects: ["https://brickschema.org/schema/1.0.1/BrickFrame#hasTag", "http://www.w3.org/2000/01/rdf-schema#label", "http://www.w3.org/1999/02/22-rdf-syntax-ns#hasTag"],
        both: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"]
    },
    predicateRelationships: [{
        relationship: 'https://brickschema.org/schema/1.0.1/BrickFrame#hasPoint',
        similar: ['http://www.w3.org/1999/02/22-rdf-syntax-ns#hasPoint', 'http://buildsys.org/ontologies/BrickFrame#hasPoint'],
        inverse: ['https://brickschema.org/schema/1.0.1/BrickFrame#isPointOf', 'https://brickschema.org/schema/1.0.1/Brick#isPointOf', 'https://brickschema.org/schema/1.0.2/BrickFrame#isPointOf', 'https://brickschema.org/schema/1.0.2/Brick#isPointOf']
    }, {
        relationship: 'https://brickschema.org/schema/1.0.1/BrickFrame#hasPart',
        similar: ['http://buildsys.org/ontologies/BrickFrame#hasPart'],
        inverse: ['https://brickschema.org/schema/1.0.1/BrickFrame#isPartOf', 'http://buildsys.org/ontologies/BrickFrame#isPartOf', 'https://brickschema.org/schema/1.0.2/BrickFrame#isPartOf']
    }, {
        relationship: 'https://brickschema.org/schema/1.0.1/BrickFrame#feeds',
        inverse: ['https://brickschema.org/schema/1.0.1/BrickFrame#isFedBy']
    }, {
        relationship: 'https://brickschema.org/schema/1.0.1/BrickFrame#contains',
        similar: ['http://www.w3.org/1999/02/22-rdf-syntax-ns#contains'],
        inverse: ['https://brickschema.org/schema/1.0.1/BrickFrame#isLocatedIn']
    }],
    excludeSelfLinks: true,
    allowOtherParentsToCollapse: true
    // excludeTypes: ['http://www.w3.org/2002/07/owl#Class', 'http://www.w3.org/2002/07/owl#Ontology']
};

const memoize = fn => {
    let cache = {};
    return (...args) => {
        let n = args[0];

        if (n in cache) {
            return cache[n];
        } else {
            let result = fn(n);
            cache[n] = result;
            return result;
        }
    };
};

function addPrefix(prefix, uri) {
    prefixes[prefix] = uri.id;
}

const fetchRdf = function(uri, format = '', resetData = false, callback = parse) {
    emitter.emit('fetching', {
        status: 'start'
    })
    console.log('START: FETCHING');
    if (resetData) reset();
    var settings = {
        "async": true,
        "crossDomain": true,
        "url": "https://cors-anywhere.herokuapp.com/" + uri,
        "method": "GET",
        "headers": {
            "cache-control": "no-cache"
        }
    };
    $.ajax(settings).done(function(rdfstring) {
        rdfString = rdfstring;
        console.log('END: FETCHING');
        emitter.emit('fetching', {
            status: 'stop',
            rdfString: rdfstring,
            format: format
        })
        if (autopilot)
            callback(rdfString, format);
    });
};

const parse = function(rdfString = '', format = '', quadCallback = store, prefixCallback = addPrefix) {
    emitter.emit('parsing', {
        status: 'start'
    })
    console.log('START: PARSING AND STORING');
    const rdfParser = N3.N3.Parser(format);
    rdfParser.parse(rdfString, quadCallback, prefixCallback);
};

const reset = function() {
    prefixes = {};
    exportData.rdf = {};
    exportData.exports = {};
    exportData.reduced = {};
    quadStore = N3.N3.Store();
    insertQuads = N3.N3.Store();
    removeQuads = N3.N3.Store();
    writer = N3.N3.Writer();
    selfLinks = N3.N3.Store();
};

const store = function(err, quad) {
    if (quad !== null) {
        if (quad.subject.id == quad.object.id) {
            selfLinks.addQuad({
                ...quad
            });
        }

        quadStore.addQuad({
            ...quad
        });
    } else {
        console.log('STOP: PARSING AND STORING');
        emitter.emit('parsing', {
            status: 'stop'
        })
        if (autopilot)
            minify();
    }
};

const identifyUndefinedNodes = function() {
    const allSubjects = new Set(quadStore.getSubjects().map(namedNode => namedNode.id));
    const allObjects = new Set(quadStore.getObjects().map(namedNode => namedNode.id));
    const allNodes = new Set([...allSubjects, ...allObjects]);
    exportData.rdf['totalNodes'] = allNodes.size;
    var defined = new Set();

    if (config.defined !== undefined) {
        var subjects = config.defined.subjects;
        var objects = config.defined.objects;
        var pairs = config.defined.both;

        if (subjects !== undefined) {
            subjects.forEach(subject => {
                quadStore.getSubjects(subject).forEach(namedNode => defined.add(namedNode.id));
            });
        }

        if (objects !== undefined) {
            objects.forEach(object => {
                quadStore.getObjects(null, object).forEach(namedNode => defined.add(namedNode.id));
            });
        }

        if (pairs !== undefined) {
            pairs.forEach(pair => {
                quadStore.getSubjects(pair).forEach(namedNode => defined.add(namedNode.id));
                quadStore.getObjects(null, pair).forEach(namedNode => defined.add(namedNode.id));
            });
        }
    }

    exportData.rdf['undefinedNodes'] = new Set([...allNodes].filter(id => !defined.has(id)));
    return exportData.rdf.undefinedNodes;
};

const minify = function(callback = analyze) {
    emitter.emit('reducing', {
        status: 'start'
    })
    console.log('START: REDUCING');

    if (config.predicateRelationships !== undefined) {
        config.predicateRelationships.forEach(predicateRelationship => {
            var similar = [];
            var inverse = [];

            if (predicateRelationship.relationship == undefined) {
                console.log('[WARNING]: Missing relationship attribute in predicateRelationships!');
            } else {
                similar.push(predicateRelationship.relationship);
            }

            if (predicateRelationship.similar !== undefined) {
                similar.push(...predicateRelationship.similar);
            }

            if (predicateRelationship.inverse !== undefined) {
                inverse.push(...predicateRelationship.inverse);
            }

            similar.forEach(relationship => {
                var quads = quadStore.getQuads(null, relationship, null);
                quadStore.removeQuads(quads);
                oldQuadsCount[relationship] = quads.length;
                quads.forEach(quad => {
                    quadStore.addQuad(quad.subject.id, similar[0], quad.object.id, quad.graph.id);
                });
            });
            inverse.forEach(relationship => {
                var quads = quadStore.getQuads(null, relationship, null);
                quadStore.removeQuads(quads);
                oldQuadsCount[relationship] = quads.length;
                quads.forEach(quad => {
                    quadStore.addQuad(quad.object.id, similar[0], quad.subject.id, quad.graph.id);
                });
            });
        });
    }

    console.log('STOP: REDUCING');
    emitter.emit('reducing', {
        status: 'stop'
    })
    if (autopilot)
        callback();
};

const analyze = function(store = quadStore, storeIn = 'rdf', callback = preprocess) {
    emitter.emit('analyzing', {
        status: 'start'
    })
    console.log('START: ANALYZING');
    exportData[storeIn]['uniqueSubjects'] = store.getSubjects().map(namedNodes => namedNodes.id);
    exportData[storeIn]['uniquePredicates'] = store.getPredicates().map(namedNodes => namedNodes.id);
    exportData[storeIn]['uniqueObjects'] = store.getObjects().map(namedNodes => namedNodes.id);
    exportData[storeIn]['uniqueTypes'] = store.getObjects(null, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type").map(namedNodes => namedNodes.id);
    exportData[storeIn]['undefinedNodes'] = identifyUndefinedNodes();
    exportData[storeIn]['uniquePrefixes'] = prefixes;
    exportData[storeIn]['selfLinks'] = selfLinks;
    exportData[storeIn]['typeCount'] = {};
    exportData[storeIn]['uniqueTypes'].forEach(type => {
        exportData[storeIn]['typeCount'][type] = quadStore.countQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', type)
    })
    exportData[storeIn]['totalTypesOfNodes'] = Object.keys(exportData[storeIn]['typeCount']).length;
    exportData[storeIn]['predicatesCount'] = {};
    exportData[storeIn]['uniquePredicates'].forEach(predicate => {
        exportData[storeIn]['predicatesCount'][predicate] = quadStore.countQuads(null, predicate, null)
    })
    exportData[storeIn]['totalTypesOfPredicates'] = Object.keys(exportData[storeIn]['predicatesCount']).length;
    exportData[storeIn]['triplesCount'] = store.countQuads();
    console.log('STOP: ANALYZING');
    emitter.emit('analyzing', {
        status: 'stop'
    })
    if (autopilot)
        callback();
};

const typoOfSubject = function(subject) {
    const types = quadStore.getObjects(subject, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    return types.length ? types[0].id : 'undefined';
};

const getType = memoize(typoOfSubject);

const getLabel = function(subject) {
    const labels = quadStore.getObjects(subject, "http://www.w3.org/2000/01/rdf-schema#label");
    return labels.length ? labels[0].id : 'undefined';
};

const preprocess = function(callback = draw) {
    emitter.emit('preprocessing', {
        status: 'start'
    });
    console.log('START: PREPROCESSING');
    exportStore.addQuads(quadStore.getQuads());

    if (config.excludeTypes !== undefined) {
        config.excludeTypes.forEach(type => {
            var excludedSubjects = exportStore.getSubjects("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", type);
            excludedSubjects.forEach(excludedSubject => {
                exportStore.removeQuads(exportStore.getQuads(excludedSubject.id));
                exportStore.removeQuads(exportStore.getQuads(null, null, excludedSubject.id));
            });
        });
    }

    if (config.excludePredicates !== undefined) {
        config.excludePredicates.forEach(predicate => exportStore.removeQuads(exportStore.getQuads(null, predicate, null)));
    }

    if (config.excludeSelfLinks !== undefined) {
        if (config.excludeSelfLinks) {
            selfLinks.getSubjects().forEach(subject => {
                exportStore.removeQuads(selfLinks.getQuads(subject.id, null, subject.id));
            });
        }
    }
    const allSubjects = new Set(exportStore.getSubjects().map(subject => subject.id));
    const allObjects = new Set(exportStore.getObjects().map(subject => subject.id));
    const exportNodes = new Set([...allSubjects, ...allObjects]);
    data.nodes = [...new Set([...exportNodes].map(node => {
        data.uniqueTypes.add(getType(node));
        return {
            id: node,
            show: false,
            collapsed: true,
            out: quadStore.getQuads(node).filter(quads=>quads.predicate.id!=='http://www.w3.org/1999/02/22-rdf-syntax-ns#type').map((quad)=>quad.object.id),
            type: getType(node),
            label: getLabel(node),
        };
    }))];
    // var newData = {nodes:[], links:[]}
    data.nodes.filter((node)=>(node.type.split('#')[1] === 'Building')).forEach((node)=>{
        node.show = true;
        // newData.nodes.push({
        //     id: node.id,
        //     show: true,
        //     collapsed: true,
        //     out: quadStore.getObjects(node.id).map((node)=>node.id),
        //     type: getType(node.id)})
    });
    data.links = exportStore.getQuads().map(quad => {
        return {
            source: quad.subject.id,
            id: quad.predicate.id,
            target: quad.object.id
        };
    });
    // data.nodes = newData.nodes;
    // data.links = newData.links;
    analyze(exportStore, 'exports', () => {});
    console.log('STOP: PREPROCESSING');
    emitter.emit('preprocessing', {
        status: 'stop',
        data: data
    })
    if (autopilot)
        callback(data);
};

const write = function() {
    emitter.emit('writing', {
        status: 'start',
        data: data
    })
    writer = N3.N3.Writer({format:'turtle'});
    writer.addPrefixes(prefixes);
    writer.addQuads(quadStore.getQuads());
    writer.end((err, str) => {
        writeString = str;

        emitter.emit('writing', {
            status: 'stop',
            data: str
        })
    });
}

const calculateDepthsByNodes = function({
    nodes,
    links
} = data, idAccessor = node => node.id) {
    // linked graph
    const graph = {};

    nodes.forEach(node => graph[idAccessor(node)] = {
        data: node,
        out: [],
        depth: -1
    });
    links.forEach(({
        source,
        target
    }) => {
        const sourceId = getNodeId(source);
        const targetId = getNodeId(target);
        if (!graph.hasOwnProperty(sourceId)) throw `Missing source node with id: ${sourceId}`;
        if (!graph.hasOwnProperty(targetId)) throw `Missing target node with id: ${targetId}`;
        const sourceNode = graph[sourceId];
        const targetNode = graph[targetId];

        sourceNode.out.push(targetNode);

        function getNodeId(node) {
            return typeof node === 'object' ? idAccessor(node) : node;
        }
    });

    traverse(Object.values(graph));

    // cleanup
    Object.keys(graph).forEach(id => graph[id] = graph[id].depth);

    return graph;

    function traverse(nodes, nodeStack = []) {
        const currentDepth = nodeStack.length;
        for (var i = 0, l = nodes.length; i < l; i++) {
            const node = nodes[i];
            if (nodeStack.indexOf(node) !== -1) {
                throw `Invalid DAG structure! Found cycle from node ${idAccessor(nodeStack[nodeStack.length - 1].data)} to ${idAccessor(node.data)}`;
            }
            if (currentDepth > node.depth) { // Don't unnecessarily revisit chunks of the graph
                node.depth = currentDepth;
                traverse(node.out, [...nodeStack, node]);
            }
        }
    }
}
