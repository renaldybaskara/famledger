const RN = {
  Platform: { OS: 'web', select: (obj) => obj.web ?? obj.default },
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
}
module.exports = RN
