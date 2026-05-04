const React = require("react");

function Link(props) {
  const { href, children, ...rest } = props;
  return React.createElement("a", { href, ...rest }, children);
}

module.exports = Link;
module.exports.default = Link;
