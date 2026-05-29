/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/weasel-words";
exports.ids = ["vendor-chunks/weasel-words"];
exports.modules = {

/***/ "(rsc)/./node_modules/weasel-words/weasel.js":
/*!*********************************************!*\
  !*** ./node_modules/weasel-words/weasel.js ***!
  \*********************************************/
/***/ ((module) => {

eval("var weasels = [\n  'are a number',\n  'clearly',\n  'completely',\n  'exceedingly',\n  'excellent',\n  'extremely',\n  'fairly',\n  'few',\n  'huge',\n  'interestingly',\n  'is a number',\n  'largely',\n  'many',\n  'mostly',\n  'obviously',\n  'quite',\n  'relatively',\n  'remarkably',\n  'several',\n  'significantly',\n  'substantially',\n  'surprisingly',\n  'tiny',\n  'various',\n  'vast',\n  'very'\n];\n\n// Allow \"too many\" and \"too few\"\nvar exceptions = [\n  'many',\n  'few'\n]\n\nvar re = new RegExp('\\\\b(' + weasels.join('|') + ')\\\\b', 'gi');\n\nmodule.exports = function (text, opts) {\n  var suggestions = [];\n  while (match = re.exec(text)) {\n    var weasel = match[0].toLowerCase();\n    if (exceptions.indexOf(weasel) === -1 ||\n        text.substr(match.index-4, 4) !== 'too ') {\n      suggestions.push({\n        index: match.index,\n        offset: weasel.length,\n      });\n    }\n  }\n  return suggestions;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvd2Vhc2VsLXdvcmRzL3dlYXNlbC5qcyIsIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFx2aXZpeVxcRG9jdW1lbnRzXFxHaXRIdWJcXFJlc3VtZS1BZ2VudC1NVlBcXG5vZGVfbW9kdWxlc1xcd2Vhc2VsLXdvcmRzXFx3ZWFzZWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIHdlYXNlbHMgPSBbXG4gICdhcmUgYSBudW1iZXInLFxuICAnY2xlYXJseScsXG4gICdjb21wbGV0ZWx5JyxcbiAgJ2V4Y2VlZGluZ2x5JyxcbiAgJ2V4Y2VsbGVudCcsXG4gICdleHRyZW1lbHknLFxuICAnZmFpcmx5JyxcbiAgJ2ZldycsXG4gICdodWdlJyxcbiAgJ2ludGVyZXN0aW5nbHknLFxuICAnaXMgYSBudW1iZXInLFxuICAnbGFyZ2VseScsXG4gICdtYW55JyxcbiAgJ21vc3RseScsXG4gICdvYnZpb3VzbHknLFxuICAncXVpdGUnLFxuICAncmVsYXRpdmVseScsXG4gICdyZW1hcmthYmx5JyxcbiAgJ3NldmVyYWwnLFxuICAnc2lnbmlmaWNhbnRseScsXG4gICdzdWJzdGFudGlhbGx5JyxcbiAgJ3N1cnByaXNpbmdseScsXG4gICd0aW55JyxcbiAgJ3ZhcmlvdXMnLFxuICAndmFzdCcsXG4gICd2ZXJ5J1xuXTtcblxuLy8gQWxsb3cgXCJ0b28gbWFueVwiIGFuZCBcInRvbyBmZXdcIlxudmFyIGV4Y2VwdGlvbnMgPSBbXG4gICdtYW55JyxcbiAgJ2Zldydcbl1cblxudmFyIHJlID0gbmV3IFJlZ0V4cCgnXFxcXGIoJyArIHdlYXNlbHMuam9pbignfCcpICsgJylcXFxcYicsICdnaScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh0ZXh0LCBvcHRzKSB7XG4gIHZhciBzdWdnZXN0aW9ucyA9IFtdO1xuICB3aGlsZSAobWF0Y2ggPSByZS5leGVjKHRleHQpKSB7XG4gICAgdmFyIHdlYXNlbCA9IG1hdGNoWzBdLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGV4Y2VwdGlvbnMuaW5kZXhPZih3ZWFzZWwpID09PSAtMSB8fFxuICAgICAgICB0ZXh0LnN1YnN0cihtYXRjaC5pbmRleC00LCA0KSAhPT0gJ3RvbyAnKSB7XG4gICAgICBzdWdnZXN0aW9ucy5wdXNoKHtcbiAgICAgICAgaW5kZXg6IG1hdGNoLmluZGV4LFxuICAgICAgICBvZmZzZXQ6IHdlYXNlbC5sZW5ndGgsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN1Z2dlc3Rpb25zO1xufTtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/weasel-words/weasel.js\n");

/***/ })

};
;