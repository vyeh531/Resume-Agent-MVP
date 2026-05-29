/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/e-prime";
exports.ids = ["vendor-chunks/e-prime"];
exports.modules = {

/***/ "(rsc)/./node_modules/e-prime/e-prime.js":
/*!*****************************************!*\
  !*** ./node_modules/e-prime/e-prime.js ***!
  \*****************************************/
/***/ ((module) => {

eval("var toBe = [\n    'am',\n    'are',\n    'aren\\'t',\n    'be',\n    'been',\n    'being',\n    'he\\'s',\n    'here\\'s',\n    'here\\'s',\n    'how\\'s',\n    'i\\'m',\n    'is',\n    'isn\\'t',\n    'it\\'s',\n    'she\\'s',\n    'that\\'s',\n    'there\\'s',\n    'they\\'re',\n    'was',\n    'wasn\\'t',\n    'we\\'re',\n    'were',\n    'weren\\'t',\n    'what\\'s',\n    'where\\'s',\n    'who\\'s',\n    'you\\'re'\n];\n\nvar re = new RegExp('\\\\b(' + toBe.join('|') + ')\\\\b', 'gi');\n\nmodule.exports = function (text) {\n    var suggestions = [];\n    if (!text || text.length === 0) return suggestions;\n    text = text.replace(/[\\u2018\\u2019]/g, \"'\"); // convert smart quotes\n    while (match = re.exec(text)) {\n        var be = match[0].toLowerCase();\n        suggestions.push({\n            index: match.index,\n            offset: be.length\n        });\n    }\n\n    return suggestions;\n};//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvZS1wcmltZS9lLXByaW1lLmpzIiwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsaURBQWlEO0FBQ2pEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7O0FBRUE7QUFDQSIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFx2aXZpeVxcRG9jdW1lbnRzXFxHaXRIdWJcXFJlc3VtZS1BZ2VudC1NVlBcXG5vZGVfbW9kdWxlc1xcZS1wcmltZVxcZS1wcmltZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgdG9CZSA9IFtcbiAgICAnYW0nLFxuICAgICdhcmUnLFxuICAgICdhcmVuXFwndCcsXG4gICAgJ2JlJyxcbiAgICAnYmVlbicsXG4gICAgJ2JlaW5nJyxcbiAgICAnaGVcXCdzJyxcbiAgICAnaGVyZVxcJ3MnLFxuICAgICdoZXJlXFwncycsXG4gICAgJ2hvd1xcJ3MnLFxuICAgICdpXFwnbScsXG4gICAgJ2lzJyxcbiAgICAnaXNuXFwndCcsXG4gICAgJ2l0XFwncycsXG4gICAgJ3NoZVxcJ3MnLFxuICAgICd0aGF0XFwncycsXG4gICAgJ3RoZXJlXFwncycsXG4gICAgJ3RoZXlcXCdyZScsXG4gICAgJ3dhcycsXG4gICAgJ3dhc25cXCd0JyxcbiAgICAnd2VcXCdyZScsXG4gICAgJ3dlcmUnLFxuICAgICd3ZXJlblxcJ3QnLFxuICAgICd3aGF0XFwncycsXG4gICAgJ3doZXJlXFwncycsXG4gICAgJ3dob1xcJ3MnLFxuICAgICd5b3VcXCdyZSdcbl07XG5cbnZhciByZSA9IG5ldyBSZWdFeHAoJ1xcXFxiKCcgKyB0b0JlLmpvaW4oJ3wnKSArICcpXFxcXGInLCAnZ2knKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodGV4dCkge1xuICAgIHZhciBzdWdnZXN0aW9ucyA9IFtdO1xuICAgIGlmICghdGV4dCB8fCB0ZXh0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIHN1Z2dlc3Rpb25zO1xuICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1tcXHUyMDE4XFx1MjAxOV0vZywgXCInXCIpOyAvLyBjb252ZXJ0IHNtYXJ0IHF1b3Rlc1xuICAgIHdoaWxlIChtYXRjaCA9IHJlLmV4ZWModGV4dCkpIHtcbiAgICAgICAgdmFyIGJlID0gbWF0Y2hbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpbmRleDogbWF0Y2guaW5kZXgsXG4gICAgICAgICAgICBvZmZzZXQ6IGJlLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VnZ2VzdGlvbnM7XG59OyJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/e-prime/e-prime.js\n");

/***/ })

};
;