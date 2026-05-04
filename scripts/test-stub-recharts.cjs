const React = require("react");

function passthroughComponent(tagName) {
  return function StubComponent(props) {
    const { children, ...rest } = props;
    return React.createElement(tagName, rest, children);
  };
}

module.exports = {
  PolarAngleAxis: passthroughComponent("div"),
  PolarGrid: passthroughComponent("div"),
  PolarRadiusAxis: passthroughComponent("div"),
  Radar: passthroughComponent("div"),
  RadarChart: passthroughComponent("div"),
  ResponsiveContainer: passthroughComponent("div"),
};
