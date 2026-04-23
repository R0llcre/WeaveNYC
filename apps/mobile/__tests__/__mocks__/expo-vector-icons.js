// `@expo/vector-icons` stub.
//
// The real package ships icon fonts + a React Native font loader.
// Our S4 chat screens render Ionicons glyphs inside the TopBar / tab bar
// / composer. Tests only need the component to render without crashing;
// the actual glyph shape is pixel-level detail that screen tests don't
// inspect. Returning a no-op component with a stable `Icon` display name
// keeps the tree structure predictable.

const React = require('react');

function makeIconSet(name) {
  const Icon = function Icon(props) {
    return React.createElement('Icon', {
      iconFamily: name,
      name: props.name,
      size: props.size,
      color: props.color,
      testID: props.testID,
    });
  };
  Icon.displayName = name;
  return Icon;
}

const Ionicons = makeIconSet('Ionicons');
const MaterialIcons = makeIconSet('MaterialIcons');
const MaterialCommunityIcons = makeIconSet('MaterialCommunityIcons');
const FontAwesome = makeIconSet('FontAwesome');
const FontAwesome5 = makeIconSet('FontAwesome5');
const Feather = makeIconSet('Feather');
const AntDesign = makeIconSet('AntDesign');
const Entypo = makeIconSet('Entypo');
const Octicons = makeIconSet('Octicons');
const SimpleLineIcons = makeIconSet('SimpleLineIcons');

module.exports = {
  __esModule: true,
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
  Feather,
  AntDesign,
  Entypo,
  Octicons,
  SimpleLineIcons,
  // Default export for any future namespace access
  default: {
    Ionicons,
    MaterialIcons,
    MaterialCommunityIcons,
  },
};
