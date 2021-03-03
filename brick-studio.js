var panning,
    drawLinks,
    showConfig = false,
    drawLabeledLinks,
    linkRenderer,
    linkArrowPosition = config.showInstances ? 0.5 : 0.8,
    mouseOnDown,
    mouseOnUp,
    mouseOnObject,
    mouseDownObject,
    mouseDown,
    mouseDownPos,
    context,
    mouseOn = 'nothing',
    selected = {},
    colorByNodeType,
    colorByPredicate,
    depthsByType,
    getNDistinctColorStrings,
    draw,
    Graph,
    graphData,
    ultimateLinkHovered,
    ultimateNodeHovered,
    penUltimateNodeHovered,
    hoverOffTimestamp,
    newNodes = {},
    fetchURI,
    newGraph,
    filename,
    nodes,
    searchNodes = [],
    lastEntry = '',
    defaultLinkWidthValue = 0.2,
    linkWidthValue = 0.2,
    INF = Math.tan(Math.PI / 2),
    mousePos = {},
    search,
    defaultZoom = 1,
    showParents,
    colorRange = {hueRange : {
            min: 0,
            max: 360
        }, saturationRange : {
            min: 50,
            max: 100
        }, lightnessRange : {
            min: 50,
            max: 75
        }},
    sound,
    editorOpen = false,
    updateName,
    updateType,
    expandAll,
    collapseAll,
    recursiveExpand,
    showNode,
    linkSourceNode = null,
    rcDrawingLink = false,
    darkTheme,
    lightTheme,
    darkMode = false,
    linkLabels = false,
    minifyIRI,
    createNew,
    canvasTxt,
    multilineLabel = config.multilineNodeLabel.enabled,
    multilineLabelFontSize = config.multilineNodeLabel.fontSize,
    multilineLabelZoomThreshold = config.multilineNodeLabel.zoomThreshold,
    startExpanded = config.startExpanded
;


$(function() {
    $('#config').hide();

    minifyIRI = function(IRI) {
        return IRI.split('#').pop();
    };

    darkTheme = function(){
        $('#viewer').css('background', '#000022')
        $('body').css('color', '#fff')

        setTimeout(function () {
            $('canvas').css('background', '#002')
        }, 500);
    };

    lightTheme = function(){
        $('#viewer').css('background', '#fff')
        $('body').css('color', '#002')
        $('canvas').css('background', '#0000')
    };

    $("#toggle-editor-button").click(function() {
        if ($("#viewer").hasClass('editor-closed')) {
            editorOpen = true;
            $("#viewer").removeClass('editor-closed');
            $("#viewer").addClass('editor-open');
            Graph.enableNodeDrag(false)
                .enableZoomPanInteraction(false)
                .onNodeClick(node => {
                    searchNodes = [];
                    Graph.graphData().links.pop();
                    if(linkSourceNode!== null && node!==linkSourceNode){
                        drawHardLink(linkSourceNode, node);
                    }
                    linkSourceNode = null;
                    rcDrawingLink = false;
                });

            Object.values(newNodes).forEach(node=>{
                node.fx = node.x;
                node.fy = node.y;
            })
            linkSourceNode = null;
            rcDrawingLink = false;
            searchNodes = [];
        } else {
            editorOpen = false
            $("#viewer").removeClass('editor-open');
            $("#viewer").addClass('editor-closed');
            Graph.enableNodeDrag(true)
                .enableZoomPanInteraction(true)
                .onNodeClick(defaultNodeClick);
            selected = {};

            Object.values(newNodes).forEach(node=>{
                node.fx = null;
                node.fy = null;
            })
        }
        $('#editor-sidebar').fadeOut(300)
    });

    $("#zoom-in-button").click(function() {
        Graph.zoom(Graph.zoom() * 2, 600)
    });

    $("#zoom-out-button").click(function() {
        Graph.zoom(Graph.zoom() / 2, 600)
    });

    drawLabeledLinks = function(link, ctx, globalScale) {
        context = ctx
        const MAX_FONT_SIZE = 4 * document.getElementById("linkWidthSlider").value;
        const LABEL_NODE_MARGIN = Graph.nodeRelSize() * 1.5;
        const start = link.source;
        const end = link.target; // ignore unbound links

        if (typeof start !== 'object' || typeof end !== 'object') return; // draw link line
        if(start.show&&end.show) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            // ctx.strokeStyle = colorByPredicate[link.id];
            ctx.strokeStyle = getLinkColor(link.id).substring(0, colorByPredicate[link.id].length - 1) + ', ' + link.source.alpha*link.target.alpha + ')';
            if (selected.source == link.source && selected.id == link.id && selected.target == link.target) {
                ctx.lineWidth = 4 * document.getElementById("linkWidthSlider").value / globalScale;

            } else {

                ctx.lineWidth = document.getElementById("linkWidthSlider").value / globalScale;
            }
            ctx.stroke(); // calculate id positioning

            const textPos = Object.assign(...['x', 'y'].map(c => ({
                [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point

            })));
            const relLink = {
                x: end.x - start.x,
                y: end.y - start.y
            };
            const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;
            let textAngle = Math.atan2(relLink.y, relLink.x); // maintain id vertical orientation for legibility

            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
            if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
            const id = `${minifyIRI(link.id)}`; // estimate fontSize to fit in link length

            ctx.font = '1px Sans-Serif';
            const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(id).width);
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(id).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
            // draw text id (with background rect)

            ctx.save();
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(textAngle);
            // ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            // ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'darkgrey';
            ctx.fillText(id, 0, 0);
            ctx.restore();
        }
    };
    drawLinks = function(link, ctx, globalScale) {
        context = ctx
        const MAX_FONT_SIZE = 4 * document.getElementById("linkWidthSlider").value;
        const LABEL_NODE_MARGIN = Graph.nodeRelSize() * 1.5;
        const start = link.source;
        const end = link.target; // ignore unbound links

        if (typeof start !== 'object' || typeof end !== 'object') return; // draw link line
        if(start.show&&end.show) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            // ctx.strokeStyle = colorByPredicate[link.id];
            ctx.strokeStyle = getLinkColor(link.id).substring(0, colorByPredicate[link.id].length - 1) + ', ' + link.source.alpha*link.target.alpha + ')';
            if (selected.source == link.source && selected.id == link.id && selected.target == link.target) {
                ctx.lineWidth = 4 * document.getElementById("linkWidthSlider").value / globalScale;

            } else {

                ctx.lineWidth = document.getElementById("linkWidthSlider").value / globalScale;
            }
            ctx.stroke(); // calculate id positioning

            const textPos = Object.assign(...['x', 'y'].map(c => ({
                [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point

            })));
            const relLink = {
                x: end.x - start.x,
                y: end.y - start.y
            };
            ctx.save();
            ctx.restore();
        }
    };


    toggleConfig = function () {
        if(showConfig){
            let value = $('#config').val();
            localStorage.setItem("config", value);
            $('#config').slideUp();
            $('#mainModal').slideDown();
            config = JSON.parse(value);
            $('#configCommand').text('EDIT');

        }else {
            $('#mainModal').slideUp();
            $('#config').slideDown();
            let value = localStorage.getItem("config");
            if(!value || value == null || value == undefined)
                value = JSON.stringify(config, null, 4);
            $('#config').val(value);
            $('#configCommand').text('SAVE');
        }
        showConfig = !showConfig;
    };

    const average = arr => arr.reduce((p, c) => p + c, 0) / arr.length;

    var getNodeColor = function(type){
        var color = colorByNodeType[type];
        if(color === undefined)
            colorByNodeType[type] = 'hsl(' + (Math.random() * 360) + ', 100%, 50%)';
        return colorByNodeType[type];
    };
    //colorByPredicate[link.id]

    var getLinkColor = function(link){
        var color = colorByPredicate[link];
        if(color === undefined)
            colorByPredicate[link] = 'hsl(' + (Math.random() * 360) + ', 100%, 50%)';
        return colorByPredicate[link];
    };
    var generateStylesByType = function() {
        colorByNodeType = {
            'https://brickschema.org/schema/1.0.1/Brick#New_Node': 'hsl(80,61%,53%)'
        };
        colorByPredicate = {
            'https://brickschema.org/schema/1.0.1/Brick#New_Link': 'hsl(120,67%,67%)'
        };
        depthsByType = {};
        var uniqueTypes = [...data.uniqueTypes];
        var nodeColors = getNDistinctColorStrings(uniqueTypes.length);

        for (var i = 0; i < uniqueTypes.length; i++) {
            colorByNodeType[uniqueTypes[i]] = (i % 2) ? nodeColors.shift() : nodeColors.pop();
        }
        var uniquePredicates = exportData.exports.uniquePredicates;
        if (uniquePredicates !== undefined) {
            var linkColors = getNDistinctColorStrings(uniquePredicates.length);

            for (var i = 0; i < uniquePredicates.length; i++) {
                colorByPredicate[uniquePredicates[i]] = (i % 2) ? linkColors.shift() : linkColors.pop();
            }
        }
    };

    draw = function(data) {
        canvasTxt = window.canvasTxt.default;
        linkRenderer = linkLabels ? drawLinks : drawLabeledLinks;
        linkArrowPosition = linkLabels ? 0.5 : 0.8;
        graphData = data;
        var elem = document.getElementById('graph');
        Graph = ForceGraph()(elem)
            .backgroundColor('#fff')
            .width(window.innerWidth * 0.79)
            .height(window.innerHeight * 0.92 - 100)
            // .linkAutoColorBy('id')
            .nodeLabel(node => {
                if(node.show){
                    try{
                        if(!config.showInstances){
                            return node.id.split('#')[node.id.split('#').length - 1]
                        }
                        let name = node.label != "undefined" ? node.label : node.id.split('#')[node.id.split('#').length - 1];
                        return `${minifyIRI(node.type)} : ${name} : ${node.out.length}`
                    }
                    catch (e) {
                        console.log('Invalid node ID: ', node.id)
                    }
                }

            })
            .linkLabel(link => {
                if(link.source.show&&link.target.show)
                    return minifyIRI(link.id)
            })
            .linkHoverPrecision(8)
            .linkWidth(link => {
                if (selected == link.source + link.id + link.target) {
                    console.log('link selected');
                    return 8;
                }
            })
            .linkColor(link => colorByPredicate[link.id].substring(0, colorByPredicate[link.id].length - 1) + ', ' + link.source.alpha*link.target.alpha + ')')
            // .linkDirectionalParticles(0.5)
            .nodeCanvasObject((node, ctx, globalScale) => {
                if(!node.show)return;
                if(node.expandedAt!==undefined && node.expandedAt+600>new Date().getTime()){
                    node.alpha = (new Date().getTime()-node.expandedAt)/(600);
                }
                else{
                    node.alpha = 1;
                }
                sides = [...data.uniqueTypes].indexOf(node.type) + 2;
                size = nodeSizeSlider.value, Xcenter = node.x, Ycenter = node.y;
                ctx.beginPath();
                ctx.moveTo(Xcenter + size * Math.cos(0), Ycenter + size * Math.sin(0));
                if(sides >3 && sides < 12){
                    for (var i = 1; i <= sides; i += 1) {
                        ctx.lineTo(Xcenter + size * Math.cos(i * 2 * Math.PI / sides), Ycenter + size * Math.sin(i * 2 * Math.PI / sides));
                    }
                }
                else{
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false)
                }
                ctx.closePath();
                var color = getNodeColor(node.type);
                if ((searchNodes.length % Graph.graphData().nodes.length !== 0)) {
                    // $('#linkWidthSlider').val(0.1);
                    // $('#linkWidth').html(0.1);
                    if (searchNodes.includes(node.id)) {
                        ctx.fillStyle = color;
                    } else {
                        ctx.fillStyle = color.substring(0, color.length - 1) + ', 0.1)';
                        node.alpha = 0.1
                    }
                } else {
                    // $('#linkWidthSlider').val(linkWidthValue);
                    // $('#linkWidth').html(linkWidthValue);
                    ctx.fillStyle = color.substring(0, color.length - 1) + ', ' + node.alpha + ')';

                }
                ctx.lineWidth = 1;
                ctx.fill();

                if (selected.id == node.id) {
                    ctx.strokeStyle = "#0006"
                    ctx.stroke();
                };
                let label = node.label != "undefined" ? node.label : minifyIRI(node.id);
                const fontSize = 15 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const outWidth = ctx.measureText(node.out.length-1).width;
                if(multilineLabel && globalScale*multilineLabelFontSize > multilineLabelZoomThreshold){
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = (nodeSizeSlider.value * globalScale) + ' pt Times'
                    canvasTxt.fontSize = multilineLabelFontSize;
                    ctx.save()
                    ctx.translate(node.x, node.y);
                    ctx.fillStyle = 'white';
                    label = label ? label : "undefined";
                    canvasTxt.drawText(ctx, label, -1*nodeSizeSlider.value, -1*nodeSizeSlider.value, 2*nodeSizeSlider.value , 2*nodeSizeSlider.value);
                    ctx.restore()
                }
                else if (3 * textWidth < nodeSizeSlider.value * globalScale) {
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'white';
                    ctx.font = (nodeSizeSlider.value * globalScale) + ' pt Times'
                    ctx.fillText(label, node.x, node.y);
                }
                else if (node.out.length > 0 && 3 * outWidth < nodeSizeSlider.value * globalScale){
                    // const bckgDimensions = [outWidth, fontSize].map(n => n + fontSize * 0.2 ); // some padding
                    // ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions)
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'white';
                    // ctx.strokeStyle = 'white';
                    ctx.fillText(node.out.length, node.x, node.y, nodeSizeSlider.value * globalScale);
                    // ctx.strokeText(node.out.length-1, node.x, node.y);
                }
            }).linkDirectionalArrowLength(link => {
                if(link.source.show&&link.target.show) {
                    return (selected == link) ? 3 * parseFloat(document.getElementById("linkWidthSlider").value) : parseFloat(document.getElementById("linkWidthSlider").value);
                }
                return 0;
            })
            .linkDirectionalArrowRelPos(linkArrowPosition)
            .warmupTicks(200)
            .onLinkHover(link => {
                if(link!==null&&!link.source.show&&!link.target.show)return;
                elem.style.cursor = link ? 'pointer' : null;

                if (link !== null) {
                    mouseOn = 'link'; // penUltimateLinkHovered = ultimateLinkHovered;
                    mouseOnObject = link;

                    ultimateLinkHovered = link; // console.log('hover link ' + link.id.split('#')[1] + ': ' + Date.now())
                } else {
                    mouseOn = 'nothing'; // console.log('hover link null: ' + Date.now())
                    mouseOnObject = {};

                    hoverOffTimestamp = Date.now();
                }
            }).onNodeHover(node => {
                if(node!==null&&!node.show)return;
                elem.style.cursor = node ? 'pointer' : null;

                if (node !== null && node !== linkSourceNode) {
                    if(rcDrawingLink){
                        searchNodes.push(node.id);
                        drawTempLink(node);
                    }
                    mouseOn = 'node';
                    mouseOnObject = node;
                    penUltimateNodeHovered = ultimateNodeHovered;
                    ultimateNodeHovered = node; // console.log('hover node ' + node.id.split('#')[1] + ': ' + Date.now())
                } else {
                    if(rcDrawingLink){
                        searchNodes = [linkSourceNode.id];
                        Graph.graphData().links.pop();
                    }
                    mouseOn = 'nothing'; // console.log('hover node null: ' + Date.now())
                    mouseOnObject = {};

                    hoverOffTimestamp = Date.now();
                }
            }).onNodeRightClick(node => {
                if(editorOpen){
                    if(linkSourceNode==null){
                        linkSourceNode = node;
                        rcDrawingLink = true;
                        searchNodes = [node.id];
                    }
                    else{
                        searchNodes = [];
                        Graph.graphData().links.pop();
                        if(node!==linkSourceNode){
                            drawHardLink(linkSourceNode, node);
                        }
                        linkSourceNode = null;
                        rcDrawingLink = false;
                    }
                }
                // console.log(node);
                // console.log(Graph.centerAt());

            })
            .onNodeClick(defaultNodeClick)
            .linkCanvasObject(linkRenderer);
        Graph.zoom(newGraph ? 18 : Graph.zoom())
        Graph.graphData(data);
        defaultZoom = Graph.zoom();

        generateStylesByType();
    };

    var defaultNodeClick = function(node) {
        if(!node.show)return;
        if(node.collapsed){
            // sound(270);
            // var children = quadStore.getQuads(node.id).filter((quad)=>minifyIRI(quad.predicate.id)!=='type').map((node)=>node.object.id);
            Graph.graphData().nodes.forEach((graphNode)=>{
                if(node.out.indexOf(graphNode.id)>-1){
                    graphNode.show = true;
                    graphNode.out= exportStore.getQuads(graphNode.id).map((q)=>q.object.id);
                    graphNode.parent = node.id;
                    graphNode.expandedAt = new Date().getTime();
                    graphNode.alpha = 0;

                }
            });
        }
        else{
            // sound(250);
            collapse(node);
        }
        node.collapsed = !node.collapsed;

    };

    var collapse = function(node){
        Graph.graphData().nodes.filter((graphNode)=>(node.out.indexOf(graphNode.id) > -1)).forEach((childNode)=>{
            if(!childNode.collapsed&&(config.allowOtherParentsToCollapse||childNode.parent===node.id)){
                collapse(childNode);
                childNode.collapsed = true;
            }
            // childNode.show = false;
        });

        Graph.graphData().nodes.forEach((graphNode)=>{
            if(node.out.indexOf(graphNode.id)>-1){
                graphNode.show = false;
            }
        });
    };

    collapseAll = function(){
        Graph.graphData().nodes.forEach(n=>{
            if(n.type.indexOf('uilding')===-1)n.show = false;
            n.collapsed = true;
        })
    };


    expandAll = function(){

        var {uniqueObjects, uniqueSubjects} = exportData.exports;
        var noIns = [...new Set([...uniqueSubjects, ...uniqueObjects])].filter((x)=>!(new Set([...uniqueObjects]).has(x)));
        var root = [];
        Graph.graphData().nodes.forEach((node)=>{
            if(noIns.indexOf(node.id)>-1){
                root.push(node.id)
            }
            node.show = false;
            node.collapsed = true;
        });
        recursiveExpand(root, null,  0);
        Graph.graphData().nodes.forEach((node)=>{
            if(noIns.indexOf(node.id)>-1){
                root.push(node.id)
            }
            node.show = true;
            node.collapsed = false;
        });
    };

    recursiveExpand = function(nodes, parent, level){
        nodes.forEach((n)=>{
            Graph.graphData().nodes.forEach((node)=>{
                if(node.id.indexOf(n)>-1 && !node.show && node.collapsed){
                    node.parent = parent;
                    node.level = level;
                    node.show = true;
                    node.collapsed = false;
                    node.out = exportStore.getQuads(node.id).map((q) => q.object.id);
                    recursiveExpand(node.out, n, level + 1);
                }
            });
        })

    }

    var nodeSizeSlider = document.getElementById("nodeSizeSlider");
    var nodeSize = document.getElementById("nodeSize");
    nodeSize.innerHTML = nodeSizeSlider.value;

    var fontSizeSlider = document.getElementById("fontSizeSlider");
    var fontSize = document.getElementById("fontSize");
    fontSize.innerHTML = fontSizeSlider.value;

    setSize = function(value) {
        Graph.nodeRelSize(value);
        nodeSizeSlider.value = value;
        nodeSize.innerHTML = value;
    };

    nodeSize.onclick = function() {
        setSize(6);
    };

    nodeSizeSlider.oninput = function() {
        Graph.nodeRelSize(this.value);
        nodeSize.innerHTML = nodeSizeSlider.value;
    };

    fontSizeSlider.oninput = function() {
        fontSize.innerHTML = fontSizeSlider.value;
        multilineLabelFontSize = fontSizeSlider.value;
    };

    var linkWidthSlider = document.getElementById("linkWidthSlider");
    var linkWidth = document.getElementById("linkWidth");
    linkWidth.innerHTML = linkWidthSlider.value;

    setLinkWidth = function(value) {
        Graph.linkDirectionalArrowLength((link)=>{
            return link.source.show&&link.target.show ? value * 4 : 0;
        })
        Graph.linkWidth(parseFloat(value));
        linkWidthSlider.value = value;
        linkWidth.innerHTML = value;
        linkWidthValue = value;
    };

    linkWidth.onclick = function() {
        setLinkWidth(defaultLinkWidthValue);
    };

    linkWidthSlider.oninput = function() {
        setLinkWidth(this.value);
    };

    $('.canvas').mousedown(function(event) {
        if(!editorOpen)return;
        // console.log('mousedown');
        mouseDownTimestamp = Date.now();
        mouseDown = true;
        mouseOnDown = mouseOn;
        mouseDownPos = getMousePosition(event);
        if (mouseOn == 'link') {
            mouseDownObject = ultimateLinkHovered;
        } else if (mouseOn == 'node') {
            mouseDownObject = ultimateNodeHovered;
        }
    });

    $('.canvas').mousemove(function(event) {
        if(!editorOpen)return;
        // console.log('mousemove');
        mousePos = getMousePosition(event);
        if ((mouseDown) && (mouseOnDown == 'node')) {
        } else if ((mouseDown) && (mouseOnDown == 'nothing')) {
            panning = true;
            Graph.centerAt(Graph.centerAt().x + mouseDownPos
                .x - mousePos.x, Graph.centerAt().y + mouseDownPos
                .y - mousePos.y)
        }
    });

    $('.canvas').mouseout(function(event) {
        if(!editorOpen)return;
        mouseDown = false;
        panning = false;
    });
    $('.canvas').bind('mousewheel', function(e) {
        if(!editorOpen)return;
        if (e.originalEvent.wheelDelta / 120 > 0) {
            Graph.zoom(Graph.zoom() * 1.5, 500);
        } else {
            Graph.zoom(Graph.zoom() / 1.5, 500);
        }
        Graph.centerAt((Graph.centerAt().x + mousePos.x) / 2, (Graph.centerAt().y + mousePos.y) / 2, 500);

    });
    var drawTempLink = function(targetNode){
        var tempLink = {
            source: linkSourceNode,
            target: targetNode,
            id: 'https://brickschema.org/schema/1.0.1/Brick#New_Link'
        };
        selected = tempLink;
        Graph.graphData().links.push(tempLink);
    }

    var drawHardLink = function(sourceNode, targetNode){
        var tempLink = {
            source: sourceNode,
            target: targetNode,
            id: 'https://brickschema.org/schema/1.0.1/Brick#New_Link'
        };
        if(sourceNode!== null){
            if(sourceNode.out!==undefined){
                sourceNode.out.push(targetNode.id);
            }
            else{
                sourceNode.out=[targetNode.id];
            }
        }
        selected = tempLink;
        $("#nodeNames").html('');
        $("#nodeTypes").html('');
        var prefix = selected.id.split('#').shift()
        $('#nodeName').val(selected.id.replace('#', ':').replace(prefix, prefixKey(prefix)));
        $('#nodeType').val(Object.keys(prefixes).filter((p)=>selected.id.split('#').shift()+'#'===prefixes[p])[0]);
        $('#editor-sidebar').fadeIn(300);
        $("#node-type").hide();
        exportData.exports.uniquePredicates.forEach((node)=>{
            var prefix = node.split('#').shift()
            $("#nodeNames").append($("<option>").attr('value', node.replace('#', ':').replace(prefix, prefixKey(prefix))));
        });

        const {nodes, links} = Graph.graphData();

        Graph.graphData({
            nodes: nodes,
            links: [tempLink, ...links]
        });
        quadStore.addQuad(sourceNode.id, tempLink.id, targetNode.id);
        exportStore.addQuad(sourceNode.id, tempLink.id, targetNode.id);
    }

    $('.canvas').mouseup(function(event) {
        if(!editorOpen)return;
        // console.log('mouseup');
        Graph.resumeAnimation();
        mouseUpTimestamp = Date.now();
        mouseDown = false;
        mouseOnUp = mouseOn;

        if (mouseOn == 'link') {
            mouseUpObject = ultimateLinkHovered;
        } else if (mouseOn == 'node') {
            mouseUpObject = ultimateNodeHovered;
        } else {
            mouseUpObject = {}
            if (selected.id !== undefined) {
                selected = {}
            } else if (/*!drawingNewLink && */!panning && !Graph.enableNodeDrag()) {
                console.log('Adding new node')
                var createdAt = new Date().getTime();
                mousePos = getMousePosition(event);
                var tempNode = {
                    id: 'https://brickschema.org/schema/1.0.1/Brick#New_Node' + createdAt.toString(),
                    type: 'https://brickschema.org/schema/1.0.1/Brick#New_Node'
                };
                tempNode['fx'] = mousePos.x;
                tempNode['fy'] = mousePos.y;
                tempNode['show'] = true;
                tempNode['collapsed'] = false;
                tempNode['out'] = [];
                tempNode['__indexColor'] = '#ccc';
                tempNode['index'] = data.nodes.length;
                tempNode['createdAt'] = createdAt;
                newNodes[createdAt] = tempNode;
                const {nodes, links} = Graph.graphData();
                Graph.graphData({
                    nodes: [tempNode, ...nodes],
                    links: links
                });
                if(!rcDrawingLink){
                    selected = tempNode;
                    rcDrawingLink = false;
                }
                $("#nodeNames").html('');
                $("#nodeTypes").html('');
                // search();
                $('#nodeName').val(minifyIRI(selected.id));
                var prefix = selected.type.split('#').shift()
                $('#nodeType').val(selected.type.replace('#', ':').replace(prefix, prefixKey(prefix)));
                $('#editor-sidebar').fadeIn(300);
                exportData.rdf.uniqueTypes.forEach((type)=>{
                    var prefix = type.split('#').shift()
                    $("#nodeTypes").append($("<option>").attr('value', type.replace('#', ':').replace(prefix, prefixKey(prefix))));
                });
                Graph.graphData().nodes.forEach((node)=>{
                    $("#nodeNames").append($("<option>").attr('value', node.id.split('#')[1]));
                });

            }
        }

        if (mouseDownObject == mouseUpObject) {
            if (mouseOnUp == 'nothing')
                selected = {};
            else {
                selected = mouseUpObject;
                $("#nodeNames").html('');
                $("#nodeTypes").html('');
                if(selected.source!==undefined){
                    var prefix = selected.id.split('#').shift()
                    $('#nodeName').val(selected.id.replace('#', ':').replace(prefix, prefixKey(prefix)));
                    $('#nodeType').val(Object.keys(prefixes).filter((p)=>selected.id.split('#').shift()+'#'===prefixes[p])[0]);
                    $('#editor-sidebar').fadeIn(300);
                    $("#node-type").hide();
                    exportData.exports.uniquePredicates.forEach((node)=>{
                        var prefix = node.split('#').shift()
                        $("#nodeNames").append($("<option>").attr('value', node.replace('#', ':').replace(prefix, prefixKey(prefix))));
                    });

                }
                else{
                    $("#node-type").show();
                    $('#nodeName').val(minifyIRI(selected.id));
                    var prefix = selected.type.split('#').shift()
                    $('#nodeType').val(selected.type.replace('#', ':').replace(prefix, prefixKey(prefix)));
                    $('#editor-sidebar').fadeIn(300);
                    exportData.rdf.uniqueTypes.forEach((type)=>{
                        var prefix = type.split('#').shift()
                        $("#nodeTypes").append($("<option>").attr('value', type.replace('#', ':').replace(prefix, prefixKey(prefix))));
                    });
                    Graph.graphData().nodes.forEach((node)=>{
                        $("#nodeNames").append($("<option>").attr('value', node.id.split('#').pop()));
                    });

                }
                console.log(mouseUpObject);
            }
        }
        mouseDownObject = {}
        mouseUpObject = {}
        panning = false;
    });


    var prefixKey = function(prefix){
        return Object.keys(prefixes).filter((p)=>prefix+'#'===prefixes[p])[0]
    };

    var deleteLink = function(selected) {
        Graph.graphData().links = Graph.graphData().links.filter(link => {
            return selected !== link
        })
        var links = quadStore.getQuads(selected.source.id, selected.id, selected.target.id);
        selected.source.out = selected.source.out.filter(node=>node.id!==selected.target.id);
        quadStore.removeQuads(links);
    }

    var deleteNode = function(selected) {
        Graph.graphData().nodes = Graph.graphData().nodes.filter(node => {
            return selected !== node
        })
        quadStore.removeQuads(quadStore.getQuads(selected.id));
        Graph.graphData().links = Graph.graphData().links.filter(link => {
            return selected !== link.source
        })
        quadStore.removeQuads(quadStore.getQuads(null, null, selected.id));
        Graph.graphData().links = Graph.graphData().links.filter(link => {
            return selected !== link.target
        })
    }

    $('.canvas').attr('tabindex', '1')
    $('.canvas').keydown(function(e) {
        if ((e.keyCode === 8 || e.keyCode === 46) && selected.id !== undefined) {
            if (selected.source !== undefined) {
                deleteLink(selected);

            } else {
                deleteNode(selected);
            }
            $('#editor-sidebar').fadeOut(300);
            selected = {}
        }
    })

    var drawFeedback = function(moveX, moveY, X, Y) {
        context.beginPath(); // Start a new path
        context.moveTo(moveX, moveY); // Move the pen to (30, 50)
        context.lineTo(X, Y); // Draw a line to (150, 100)
        context.stroke(); // Render the path
    }



    var getMousePosition = function(event) {
        var ctx = $('canvas')[0].getContext('2d');
        var canvas = $('canvas')[0];
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var pos = {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
        var imatrix = ctx.getTransform().invertSelf();
        return {
            x: pos.x * imatrix.a + imatrix.e,
            y: pos.y * imatrix.d + imatrix.f
        };
    };

    getNDistinctColorStrings = function(n) {
        var {hueRange, saturationRange, lightnessRange} = colorRange;
        var colors = [];
        var hueRangeTotal = hueRange.max - hueRange.min + 1;
        var saturationRangeTotal = saturationRange.max - saturationRange.min;
        var lightnessRangeTotal = lightnessRange.max - lightnessRange.min;
        var total = hueRangeTotal * saturationRangeTotal * lightnessRangeTotal;

        var getColorString = function(num) {
            var l = lightnessRange.min + num % lightnessRangeTotal;
            num /= lightnessRangeTotal;
            var s = saturationRange.min + num % saturationRangeTotal;
            num /= saturationRangeTotal;
            var h = hueRange.min + num % hueRangeTotal;
            return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
        };

        var colorDiff = total / n;

        for (var i = 0; i < n; ++i) {
            colors.push(getColorString(colorDiff * i));
        }

        return colors;
    };

    $('#dag').click(() => {
        if (Graph.dagMode() !== 'radialout')
            Graph.dagMode('radialout')
        else {
            Graph.dagMode('null')
        }
        search();
    });

    $('#darkMode').click(() => {
        if (!darkMode)
            darkTheme()
        else {
            lightTheme()
        }
        darkMode = !darkMode;
    })

    $('#linkLabels').click(() => {
        console.log(linkLabels, linkArrowPosition)
        if (linkLabels){
            linkRenderer = drawLabeledLinks;
            linkArrowPosition = 0.8;
            console.log("Using drawLabeledLinks");
        }
        else {
            linkRenderer = drawLinks;
            linkArrowPosition = 0.5;
            console.log("Using drawLinks");
        }
        Graph.linkCanvasObject(linkRenderer)
            .linkDirectionalArrowRelPos(linkArrowPosition);
        linkLabels = !linkLabels;
    })

    downloadFile = function() {
        if(filename === undefined || filename.length == 0){
            filename = 'brick_model.ttl'
        }
        filename = filename.split('/')[filename.split('/').length - 1];
        write()

    }

    fetchURI = function() {
        filename = $('#ttluri').val()
        if (filename !== '') {
            newGraph = false;
            fetchRdf(filename, '', resetData = true);
        } else {
            newGraph = true;
            createNew()
        }

    }

    createNew= function() {
        $('#modal').hide()
        parse('');
    }

    emitter.on('fetching', (data) => {
        if (data.status == 'start') {
            $('#enterURL').hide();
            $('#fetching').show();
            console.log('fetching')
        } else {
            $('#fetching').hide();
            console.log('fetching STOP')
            parse(data.rdfString, data.format)
        }
    })

    emitter.on('parsing', (data) => {
        if (data.status == 'start') {
            $('#parsing').show();
            console.log('parsing')
        } else {
            console.log('parsing STOP')
            $('#parsing').hide(duration = 10, complete = () => {
                analyze(quadStore, 'rdf');
            })

        }
    })

    emitter.on('analyzing', (data) => {
        if (data.status === 'start') {
            $('#analyzing').show();
            console.log('analyzing')
        } else {

            $('#analyzing').hide(duration = 10, complete = () => {
                if (Object.keys(exportData.reduced).length === 0) {
                    if (!config.showInstances)
                        hideInstances()
                    minify()
                } else if (Object.keys(exportData.exports).length === 0) {
                    preprocess()
                }
            })
        }
    });

    emitter.on('reducing', (data) => {
        if (data.status === 'start') {
            $('#reducing').show();
            console.log('reducing')
        } else {
            $('#reducing').hide(duration = 10, complete = () => {
                analyze(quadStore, 'reduced')
            })
        }
    });

    emitter.on('preprocessing', (data) => {
        if (data.status === 'start') {
            $('#preprocessing').show();
            console.log('preprocessing')
        } else {
            $('#preprocessing').hide();
            $('#modal').hide(duration = 10, complete = () => {
                if(!config.showInstances){
                    $('#linkLabels').prop('checked', true);
                    $('#download').hide();
                    $('#toggle-editor-button').hide();
                }
                else{
                    linkLabels = true;
                }
                draw(data.data);
                nodes = data.data.nodes.map((node) => node.id);
                if(startExpanded){
                    collapseAll();
                    expandAll();
                }
            })

        }
    });

    emitter.on('writing', (data) => {
        if (data.status === 'start') {
            console.log('writing')
        } else {
            var element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data.data));
            element.setAttribute('download', filename);

            element.style.display = 'none';
            document.body.appendChild(element);

            element.click();

            document.body.removeChild(element);
        }
    });

    $('#exportAnalysis').click(()=>{

        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData.rdf, null, 2)));
        element.setAttribute('download', 'analysis.json');

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    });

    $("#search").keyup(async function(event) {
        search();
    });

    search = function(){
        var searchParams = $(' input[name="searchBy"]');
        var searchParam;
        for(var i = 0; i < searchParams.length; i++){
            if(searchParams[i].checked){
                searchParam = searchParams[i];
                break;
            }
        }
        const value = $("#search").val();
        lastEntry = value;
        searchNodes = Graph.graphData().nodes.filter((node) => (minifyIRI(node[searchParam.value]).search(new RegExp(lastEntry, "i")) > -1));
        let xMin = INF,
            yMin = INF,
            xMax = -INF,
            yMax = -INF;
        for (let i = 0; i < searchNodes.length; i++) {
            if (searchNodes[i].x < xMin) xMin = searchNodes[i].x;
            if (searchNodes[i].x > xMax) xMax = searchNodes[i].x;
            if (searchNodes[i].y < yMin) yMin = searchNodes[i].y;
            if (searchNodes[i].y > yMax) yMax = searchNodes[i].y;
        }
        searchNodes = searchNodes.map(node => node.id);

        if(searchNodes.length === Graph.graphData().nodes.length){
            searchNodes = []
        }
        if (searchNodes.length === 0) {
            Graph.centerAt(0, 0, 1000);
            Graph.zoom(defaultZoom, 1000)
        }
        else if (searchNodes.length === 1) {
            Graph.centerAt((xMin + xMax) / 2, (yMin + yMax) / 2, 1000);
            Graph.zoom(8, 1000)
        } else if (searchNodes.length > 1) {
            Graph.centerAt((xMin + xMax) / 2, (yMin + yMax) / 2, 1000);
            let wRatio = (xMax - xMin) / Graph.width();
            const hRatio = (yMax - yMin) / Graph.height();
            if (wRatio < hRatio) wRatio = hRatio;
            Graph.zoom(0.8 / wRatio, 1000);
        }
    }

    var audioContext = new AudioContext();
    $('#search').click((event)=>{search()});
    sound = function(frequency, type = 'sine', x = 1.5){

        var o = null;
        var g = null;
        o = audioContext.createOscillator();
        g = audioContext.createGain();
        o.connect(g);
        o.type = type;
        g.connect(audioContext.destination);
        o.start(0);
        if(frequency!==undefined)
            o.frequency.value = frequency;
        g.gain.exponentialRampToValueAtTime(
            0.00001, audioContext.currentTime + x
        )
    }

    showParents = function(){

        var {uniqueObjects, uniqueSubjects} = exportData.exports;
        var noIns = [...new Set([...uniqueSubjects, ...uniqueObjects])].filter((x)=>!(new Set([...uniqueObjects]).has(x)));
        Graph.graphData().nodes.forEach((node)=>{
            if(noIns.indexOf(node.id)>-1){
                node.show = true;
                node.out= exportStore.getQuads(node.id).map((q)=>q.object.id);
                node.expandedAt = new Date().getTime();
                node.alpha = 0;
            }
            else{
                node.show = false;
            }
            node.collapsed = true;
        })
    }

    updateName = function(){
        var oldQuads, newQuads;
        if(selected==={}){
            return
        }
        else if($('#nodeName').val()===''){
            $('#nodeName').val(minifyIRI(selected.id))
        }
        else if(selected.source!==undefined){
            //from QuadStore
            oldQuads = quadStore.getQuads(selected.source.id, selected.id, selected.target.id);
            var prefix = $('#nodeName').val().split(':').shift()
            var newPredicate = $('#nodeName').val().replace(':', '#').replace(prefix, prefixes[prefix]).replace('##', '#')
            $('#nodeType').val(Object.keys(prefixes).filter((p)=>selected.id.split('#')[0]+'#'===prefixes[p])[0]);
            quadStore.removeQuads(oldQuads);
            newQuads = oldQuads.map((quad)=>{
                quad.predicate.id = newPredicate;
                return quad;
            })
            quadStore.addQuads(newQuads);

            // from graphData
            Graph.graphData().links.forEach((link)=>{
                if(link.id===selected.id&&link.source.id===selected.source.id&&link.target.id===selected.target.id){
                    link.id = newPredicate;
                }
            })
            selected.id = newPredicate;
            //changeSelected

        }
        else{

            oldQuads = quadStore.getQuads(null, null, selected.id);
            var prefix = Graph.graphData().nodes.filter((node)=>node.type.indexOf('uilding')>-1)[0].id.split('#')[0];
            var newId = prefix+'#'+$('#nodeName').val();
            quadStore.removeQuads(oldQuads);
            newQuads = oldQuads.map((quad)=>{
                quad.object.id = newId;
                return quad;
            });
            quadStore.addQuads(newQuads);

            oldQuads = quadStore.getQuads(selected.id, null, null);
            quadStore.removeQuads(oldQuads);
            newQuads = oldQuads.map((quad)=>{
                quad.subject.id = newId;
                return quad;
            });
            quadStore.addQuads(newQuads);

            // from graphData
            Graph.graphData().links.forEach((link)=>{
                if(link.source===selected.id){
                    link.source = newId;
                }
                if(link.target===selected.id){
                    link.target = newId;
                }
            });
            Graph.graphData().nodes.forEach((node)=>{
                if(node.id===selected.id){
                    node.id = newId;
                }
                if(node.out.indexOf(selected.id)>-1){
                    node.out.forEach((id)=>{
                        if(id === selected.id)
                            return newId;
                        else
                            return id;
                    })
                }
            });
            selected.id = newId;

        }
    };

    updateType = function(){
        if(selected.source!==undefined){
            //console.log("Update prefix type")
        }
        else{
            quadStore.removeQuads(quadStore.getQuads(selected.id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', selected.type));
            var prefix = $('#nodeType').val().split(':').shift()
            var newType = $('#nodeType').val().replace(':', '#').replace(prefix, prefixes[prefix]).replace('##', '#');
            if(newType===undefined){
                newType = prefixes['brick']+$('#nodeType').val();
            }
            // console.log(newType);
            selected.type =  newType;
            quadStore.addQuad(selected.id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', selected.type);
            console.log(selected.id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', selected.type);
        }
    };


    showNode = function(id){
        Graph.graphData().nodes.forEach((node)=>{
            if(node.id===id){
                node.show = true;
                // node.parent =
            }
        })
    };

    $('#nodeName').on('keypress',function(e) {
        if(e.which === 13) {
            updateName();
            $(this).blur();
            if(selected.source!==undefined){
                selected = {}
            }
        }
    });
    $('#nodeType').on('keypress',function(e) {
        if(e.which === 13) {
            updateType();
            $(this).blur();
        }
    });

    $('#nodeName').on('click',function(e) {
        if($(this).val().substring(0, 3)==='New'){
            $(this).val('');
        }
    });

    $('#nodeType').on('click',function(e) {
        if($(this).val().substring(0, 3)==='New'){
            $(this).val('');
        }
    });

    function readSingleFile(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            var contents = e.target.result;
            $('#enterURL').hide();
            parse(contents)
        };
        reader.readAsText(file);
    }

    document.getElementById('file-input').addEventListener('change', readSingleFile, false);
});
