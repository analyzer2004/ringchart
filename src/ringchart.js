// https://github.com/analyzer2004/ringchart
// Copyright 2020 Eric Lo
class RingChart {
    constructor(container) {
        this._container = container;

        this._width = 0;
        this._height = 0;
        this._diameter = 0;
        this._radius = {
            inner: 50,
            outer: 0,
            node: 0,
            max: 0
        };

        this._palette = d3.schemeTableau10;

        // options
        this._options = {
            order: "asc",
            nodeStyle: "arc",
            chartType: "rankmap",
            clickAction: "highlight",
            stickyNodes: true,
            showZeros: true,
            alwaysShowLines: false,
            fixedNodeRadius: 0
        };

        this._legend = {
            enabled: true,
            centered: true,
            fontSize: "9pt",
            format: ".2s",
            labelColor: "#666",
            num: 7
        }

        // elements
        this._g = null;
        this._lines = null;
        this._dots = null;
        this._yTicks = null;        
        this._legendBox = null;
        this._legendItems = null;

        // data
        this._tick = {
            name: "",
            isDate: false,
            format: "",
            fontSize: "9pt",
            color: "#666"
        };
        this._data = null;
        this._chartData = null;
        this._min = 0;
        this._max = 0;
        this._keys = null;
        this._sortedKeys = null;
        this._ranks = null;

        // scales
        this._xl = null;
        this._xb = null;
        this._y = null;
        this._color = null;
        this._bandwidth = { x: 0, y: 0 };

        this._isArc = false;
        this._isSeq = false;

        this._focus = null;
        this._uniqueId = new String(Date.now() * Math.random()).replace(".", "");

        // events
        this._onhover = null;
        this._onclick = null;
        this._oncancel = null;
    }

    size(_) {
        return arguments.length ? (this._width = _[0], this._height = _[1], this) : [this._width, this._height];
    }

    innerRadius(_) {
        return arguments.length ? (this._radius.inner = _, this) : this._radius.inner;
    }

    palette(_) {
        return arguments.length ? (this._palette = _, this) : this._palette;
    }

    options(_) {
        return arguments.length ? (this._options = Object.assign(this._options, _), this) : this._options;
    }

    legend(_) {
        return arguments.length ? (this._legend = Object.assign(this._legend, _), this) : this._legend;
    }

    tick(_) {
        return arguments.length ? (this._tick = Object.assign(this._tick, _), this) : this._tick;
    }

    data(_) {
        return arguments.length ? (this._data = _, this) : this._data;
    }

    onhover(_) {
        return arguments.length ? (this._onhover = _, this) : this._onhover;
    }

    onclick(_) {
        return arguments.length ? (this._onclick = _, this) : this._onclick;
    }

    oncancel(_) {
        return arguments.length ? (this._oncancel = _, this) : this._oncancel;
    }

    render() {
        this._init();
        this._process();
        this._initScales();
        this._renderChart();
        if (this._legend.enabled) this._renderLegend();
        return this;
    }

    _init() {
        this._isArc = this._options.nodeStyle === "arc";
        this._isSeq = this._options.chartType === "heatmap";

        const cb = this._getCharBox(this._tick.fontSize);
        this._radius.outer = Math.min(this._width, this._height) - (cb.height + 10); // dy of ticks = 10
    }

    _process() {
        const
            op = this._options,
            ascending = op.order === "asc";

        this._processKeys();
        const cd = this._data.map(d => {
            const tick = d[this._tick.name];
            const row = {
                tick: tick,
                values: this._keys.map(key => {
                    const value = +d[key];

                    if (value < this._min) this._min = value;
                    else if (value > this._max) this._max = value;

                    return { tick, key, value };
                })
            };

            const sorting = op.chartType === "rankmap" ? row.values : row.values.map(r => r);
            if (ascending) sorting.sort((a, b) => a.value - b.value);
            else sorting.sort((a, b) => b.value - a.value);

            const len = sorting.length;
            sorting.forEach((d, i) => d.rank = ascending ? len - i : i + 1);

            return row;
        });

        if (op.chartType === "rankmap") {
            this._sortedKeys = cd[0].values.map(d => d.key);
            this._ranks = this._sortedKeys.map(key => ({
                key: key,
                series: cd.map(row => {
                    var index = row.values.findIndex(_ => _.key === key);
                    if (!op.showZeros && row.values[index].value === 0) index = -1;
                    return {
                        tick: row.tick,
                        index: index
                    }
                })
            }));
        }

        this._chartData = cd;
    }

    _processKeys() {
        const keys = Object.keys(this._data[0]);

        if (this._tick.name === "") {
            this._tick.name = keys[0];
            this._keys = keys.slice(1);
        }
        else {
            const index = keys.indexOf(this._tick.name);
            if (index > -1) {
                keys.splice(index, 1);
                this._keys = keys;
            }
            else throw "Invalid tick field.";
        }
    }

    _initScales() {
        const
            op = this._options,
            radius = this._calculateRadius();

        this._xl = d3.scaleLinear().domain([0, this._chartData.length]).range([0, 360]);
        this._xb = d3.scaleBand().domain(this._seq(0, this._chartData.length)).range([0, 2 * Math.PI]);

        radius.max = this._isArc || !op.stickyNodes ? radius.outer / 2 : radius.inner + radius.node * 2 * this._keys.length;
        if (op.showZeros) {
            this._y = d3.scaleBand().domain(this._seq(0, this._keys.length)).range([radius.inner, radius.max]);
        }
        else {
            // y scale is from -1 to keys.length, -1 is for zero nodes
            const u = (radius.max - radius.inner) / (this._keys.length + 1);
            this._y = d3.scaleBand().domain(this._seq(-1, this._keys.length + 1)).range([radius.inner - u, radius.max]);
        }

        if (op.chartType === "rankmap")
            this._color = d3.scaleOrdinal().domain(this._keys).range(this._palette);
        else
            this._color = d3.scaleSequential(this._palette).domain([this._min, this._max]).nice();

        this._bandwidth.x = this._xb.bandwidth();
        this._bandwidth.y = this._y.bandwidth();
    }

    _calculateRadius() {
        const radius = this._radius;
        if (this._options.fixedNodeRadius)
            radius.node = this._options.fixedNodeRadius;
        else {
            const
                r1 = 2 * Math.PI * radius.inner / this._chartData.length / 2,
                r2 = (radius.outer / 2 - radius.inner) / (this._keys.length * 2);
            radius.node = Math.min(r1, r2);
        }
        return radius;
    }

    _renderChart() {
        const op = this._options;

        this._g = this._container.append("g")
            .attr("transform", `translate(${this._width / 2},${(this._height / 2)})`);

        if (op.chartType === "rankmap") this._renderLines();
        if (this._isArc)
            this._renderArcs();
        else
            this._renderDots();

        this._dots.append("title")
            .text(d => `${d.tick} - ${d.key}\nRank: ${d.rank}\nValue: ${d.value}`);

        this._attachEvents(this._dots);

        this._renderAxis();
        if (op.chartType === "heatmap") this._renderAxisY();
    }

    _renderLines() {
        var a = 0, r = 0;
        if (this._isArc) {
            a = this._bandwidth.x / 2;
            r = this._bandwidth.y / 2;
        }

        const line = d3.lineRadial()
            .curve(d3.curveLinearClosed)
            .angle((d, i) => this._xb(i) + a)
            .radius(d => this._y(d.index) + r);

        const opacity = this._options.alwaysShowLines ? 1 : 0;
        this._lines = this._g.selectAll(".line")
            .data(this._ranks)
            .join("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("opacity", opacity)
            .attr("stroke", (d, i) => this._color(this._sortedKeys[i]))
            .attr("stroke-width", 2)
            .attr("d", d => line(d.series));
    }

    _renderArcs() {
        const arc = d3.arc()
            .innerRadius((d, i) => this._y(i))
            .outerRadius((d, i) => this._y(i) + this._bandwidth.y)
            .startAngle(d => this._xb(d.index))
            .endAngle(d => this._xb(d.index) + this._bandwidth.x);

        this._dots = this._g.append("g")
            .selectAll("g")
            .data(this._chartData)
            .join("g")
            .selectAll("path")
            .data((d, i) => d.values.map(v => Object.assign({ index: i }, v)))
            .join("path")
            .attr("fill", d => this._getColor(d))
            .attr("d", arc);
    }

    _renderDots() {
        const
            op = this._options,
            radius = this._radius,
            x = 2 * radius.node;

        const g = this._g.append("g")
            .selectAll("g")
            .data(this._chartData)
            .join("g")
            .attr("transform", (d, i) => `rotate(${this._xl(i) - 90})`);

        if (op.nodeStyle === "circle") {
            this._dots = g.selectAll("circle")
                .data(d => d.values)
                .join("circle")
                .attr("fill", d => this._getColor(d))
                .attr("cx", (d, i) => op.stickyNodes ? i * x + radius.inner : this._y(i))
                .attr("r", radius.node);
        }
        else {
            const
                w = radius.node * 2,
                hb = this._bandwidth.y / 2;

            this._dots = g.selectAll("rect")
                .data(d => d.values)
                .join("rect")
                .attr("fill", d => this._getColor(d))
                .attr("x", (d, i) => (op.stickyNodes ? i * x + radius.inner : this._y(i)) - hb)
                .attr("y", op.stickyNodes ? -radius.node : -hb)
                .attr("width", w).attr("height", w);
        }
    }

    _renderAxis() {
        const
            radius = this._radius,
            id = "axis_" + this._uniqueId,
            scale = d3.scaleLinear()
                .domain([0, this._chartData.length - 1])
                .range([0, 100 - (100 / this._chartData.length)]);

        this._drawCircle(id, radius.max);
        let ticks = scale.ticks();
        if (ticks.length > this._chartData.length) ticks = scale.ticks(this._chartData.length);
        this._g.selectAll(".tick")
            .data(ticks)
            .join("g")
            .style("font-size", this._tick.fontSize)
            .attr("class", "tick")
            .attr("transform", "rotate(90)")
            .call(g => g.append("line")
                .attr("stroke", this._tick.color)
                .attr("stroke-dasharray", "1,2")
                .attr("x1", -radius.inner)
                .attr("x2", -radius.max - 10)
                .attr("transform", d => `rotate(${360 * scale(d) / 100})`))
            .call(g => g.append("text")
                .attr("dx", 3)
                .attr("dy", -5)
                .attr("fill", this._tick.color)
                .append("textPath")
                .attr("xlink:href", "#" + id)
                .attr("startOffset", d => scale(d) + "%")
                .text((d, i) => {
                    if (Number.isInteger(d)) {
                      const s = this._chartData[d].tick;
                      if (this._tick.isDate) {
                          const date = this._tick.format !== "" ? d3.timeParse(s) : new Date(s);
                          return date.toLocaleDateString();
                      }
                      else
                          return s;
                    }
                }));
    }
    
    _drawCircle(id, radius) {
        this._g.append("path")
            .attr("id", id)
            .attr("fill", "none")
            .attr("stroke", "none")
            .attr("d",
                "M 0, 0 " +
                "m " + -radius + ",0 " +
                "a " + radius + "," + radius + " 0 0,1 " + radius * 2 + ",0 " +
                "a " + radius + "," + radius + " 0 0,1 " + (-radius * 2) + ",0 "
            );
    }

    _renderAxisY() {
        this._keys.forEach((d, i) => {
            const id = `axisY${i}_${this._uniqueId}`;
            this._drawCircle(id, this._y(i));
        });

        this._yTicks = this._g.append("g")
            .style("font-size", this._tick.fontSize)
            .attr("transform", "rotate(90)")
            .selectAll("text")
            .data(this._keys)
            .join("g")
            .style("visibility", "hidden")
            .call(g => {
                g.append("text")
                    .attr("dx", "0.5em")
                    .attr("stroke", "white")
                    .attr("stroke-width", 2)
                    .attr("fill", "none")
                    .call(t => {
                        t.append("textPath")
                            .attr("xlink:href", (d, i) => `#axisY${i}_${this._uniqueId}`)
                            .text(d => d)
                    })
                    .clone(true)
                    .attr("stroke", "none")
                    .attr("fill", this._tick.color);
            });
    }

    _renderLegend() {
        const
            w = 15,
            spacing = 2.5,
            format = d3.format(this._legend.format),
            h = this._getCharBox(this._legend.fontSize).height;

        this._legendBox = this._container.append("g")
            .style("font-size", this._legend.fontSize);

        const items = this._processLegend();
        const legend = this._legendItems = this._legendBox.selectAll("g")
            .data(items)
            .join("g")
            .attr("transform", (d, i) => `translate(0,${i * (h + spacing)})`)
            .call(g => g.append("rect")
                .attr("fill", d => this._isSeq ? this._color(d.f) : this._color(d.key))
                .attr("rx", 4).attr("ry", 4)
                .attr("width", w).attr("height", h))
            .call(g => g.append("text")
                .attr("dy", "1em")
                .attr("fill", this._legend.labelColor)
                .attr("transform", `translate(${w + spacing},0)`)
                .text((d, i) => {
                    if (this._isSeq)
                        return i < items.length - 1 ? `${format(d.f)} - ${format(d.c)}` : `> ${format(d.f)}`;
                    else
                        return d.key;
                }));

        this._attachEvents(legend);

        var centered = this._legend.centered;
        const
            box = this._legendBox.node().getBBox(),
            threshold = this._radius.inner - this._radius.node;

        if (box.width / 2 >= threshold || box.height / 2 >= threshold) centered = false;
        if (centered)
            this._legendBox.attr("transform", `translate(${(this._width - box.width) / 2},${(this._height - box.height) / 2})`);
        else {
            const
                left = (this._width / 2) + this._y.range()[1] + h + 15,
                top = (this._height / 2) - this._y.range()[1];

            this._legendBox.attr("transform", `translate(${left},${top})`);
        }
    }

    _processLegend() {
        if (this._options.chartType === "rankmap")
            return this._keys.map(d => ({ key: d }));
        else {
            const
                ranges = [],
                ticks = this._color.ticks(this._legend.num);

            for (let i = 0; i < ticks.length - 1; i++) {
                ranges.push({ f: ticks[i], c: ticks[i + 1] });
            }
            return ranges;
        }
    }

    _attachEvents(selections) {
        const op = this._options;
        selections.attr("opacity", 1)
            .on("click", (e, d) => {
                if (op.clickAction === "none") return;

                const f = this._focus;
                if (f && (f === d || f.key && f.key === d.key)) {
                    this._focus = null;
                    this._cancel();
                    if (this._oncancel) this._oncancel(d);
                }
                else {
                    this._focus = d;
                    this._highlight(d);                    
                    if (this._onclick) this._onclick(d);
                }
                e.stopPropagation();
            })
            .on("mouseenter", (e, d) => {
                if (!this._focus) {
                    this._highlight(d);
                    if (this._onhover) this._onhover(d);
                }
            })
            .on("mouseleave", (e, d) => { if (!this._focus) this._cancel(); });

        this._container.on("click.eric.ringchart." + this._uniqueId, () => {
            if (op.clickAction === "none") return;
            this._focus = null;
            this._cancel();
        })
    }

    _highlight(d) {
        if (this._isSeq) {
            const t = this._dots.transition().duration(500);
            if (d.key) {
                t.attr("opacity", _ => _.key === d.key ? 1 : 0.2);
                this._yTicks.style("visibility", _ => _ === d.key ? "visible" : "hidden");
            }
            else
                t.attr("opacity", _ => _.value >= d.f && _.value < d.c ? 1 : 0.2);
        }
        else {
            this._dots.transition().duration(500).attr("opacity", _ => _.key === d.key ? 1 : 0.2);
            if (this._lines) {
                const opacity = this._options.alwaysShowLines ? 0.2 : 0; 
                this._lines.transition().duration(250).attr("opacity", _ => _.key === d.key ? 1 : opacity);
            }            
            if (this._yTicks) this._yTicks.style("visibility", _ => _ === d.key ? "visible" : "hidden");
            if (this._legendItems) this._legendItems.style("font-weight", _ => _.key === d.key ? "bold" : "");
        }
    }

    _cancel() {
        this._dots.transition().duration(500).attr("opacity", 1);
        if (this._lines) {
            const opacity = this._options.alwaysShowLines ? 1 : 0;
            this._lines.transition().duration(250).attr("opacity", opacity);
        }        
        if (this._yTicks) this._yTicks.style("visibility", "hidden");
        if (this._legendItems) this._legendItems.style("font-weight", "");
    }

    _getColor(d) {
        return !this._options.showZeros && d.value === 0 ? "none" : this._color(this._isSeq ? d.value : d.key);
    }

    _getCharBox(fontSize) {
        var text;
        try {
            text = this._container.append("text")
                .attr("font-size", fontSize)
                .text("M");
            return text.node().getBBox();
        }
        finally {
            if (text) text.remove();
        }
    }

    _seq(start, length) {
        return Array.from({ length: length }).map((d, i) => start + i);
    }
}