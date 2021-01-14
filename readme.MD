# Ring Chart

The original concept of **RingChart** was to create a radial bump chart that is suitable for showing a larger dataset over a more extended period in a single view. A standard bump chart is excellent for displaying 15 to maybe 30 ticks. But what if you need to present a 3-month dataset in an interpretable fashion?

By utilizing the circular design, the chart becomes capable of displaying more data without compromising visual quality. As the demo below, the RingChart neatly visualizes a 90-day dataset in an exquisite style.

For live demos and sample codes, please see [Ring Chart](https://observablehq.com/@analyzer2004/ringchart)

<img src="https://github.com/analyzer2004/ringchart/blob/master/images/cover.png" width="768">

## API Reference
* **RingChart(container)** - Constructs a new instance of RingChart with default settings. The container can be an svg or g element.
* **size([width, height])** - Sets the dimensions to specified width and height and returns this chart.
* **innerRadius(_)** - Sets the chart's inner radius and returns this chart.
* **palette(_)** - Sets the color palette to a categorical scheme *(for rankmap)* or a continuous interpolator *(heatmap)* and returns this chart.
* **options(options)** - Overrides the default settings and returns this chart.
  * options.**order** - sets the sort order to *"asc"* or *"desc"*. Default is ascending.
  * options.**nodeStyle** - specifies the node styles. Available styles are *"arc"*, *"circle"* and *"square"*. Default is arc.
  * options.**chartType** - sets the chart type to *"rankmap"* (bump chart) or *"heatmap"*. Default is heatmap.
  * options.**clickAction** - specifies the click action to *"none"* or *"highlight"*. Default is highlight.
  * options.**stickNodes** - specifies whether the nodes are always stick together if the *nodeStyle* is circle or square. Default is true.
  * options.**showZeros** - specifies whether the nodes with zero value should be plotted. Default is true.
  * options.**alwaysShowLines** - specifies whether the rank lines are always displayed. By turning this option on the chart becomes a radar chart. The default value is false.
  * options.**fixedNodeRadius** - specifies a fixed radius for nodes.
* **legend(legend)** - Overrides the legend settings and returns this chart.
  * legend.**enabled** - a boolean value that indicates whether the legend is enabled or disabled. Default is true.
  * legend.**centered** - specifies whether the legend is placed at the center of the ring. Default is true.
  * legend.**fontSize** - sets the legend's font size.
  * legend.**format** - sets the legend's number format. (for heatmap)
  * legend.**labelColor** - sets the legend's text color.
  * legend.**num** - sets the number of legend items. (for heatmap)
* **tick(tick)** - Overrides the tick settings and returns this chart.
  * tick.**name** - sets the column name of ticks
  * tick.**isDate** - specifies whether the tick column is Date
  * tick.**format** - sets the format *(d3.timeParse)* for parsing the tick column. Default is empty.
  * tick.**fontSize** - sets the tick's font size
  * tick.**color** - sets the tick's text color
* **data(_)** - Sets the data and returns this chart.
* **render()** - Renders the chart and returns it's instance.
* **onhover(d)** - Occurs when user hover over a node or a legend item.
* **onclick(d)** - Occurs when user click on a node or a legend item.
* **oncancel()** - Occurs when cancelling the locked highlight.`