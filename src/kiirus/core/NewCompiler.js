const escapeRE = /(?:(?:&(?:amp|gt|lt|nbsp|quot);)|"|\\|\n)/g;
const escapeMap = {
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&nbsp;': ' ',
  '&quot;': "\\\"",
  '\\': "\\\\",
  '"': "\\\"",
  '\n': '\\n'
}
const expressionRE = /"[^"]*"|'[^']*'|\d+[a-zA-Z$_]\w*|\.[a-zA-Z$_]\w*|[a-zA-Z$_]\w*:|([a-zA-Z$_]\w*)/g
const globals = ['NaN', 'false', 'in', 'null', 'this', 'true', 'typeof', 'undefined']
const whitespaceRE = /^\s+$/
const identationRegex = /^[\s|\t]+/gmi
const cssCommentsRegex = /(\/\*[\s\S]*?\*\/)/gi

export default class Compiler {
  static compile (input) {
    return this.parse(input.replace(cssCommentsRegex, ''))
  }

  static isComponentType (type) {
     return type[0] === type[0].toUpperCase() && type[0] !== type[0].toLowerCase()
  }

  static parse (input) {
    const length = input.length

    const root = {
      element: 0,
      referenceElement: 1,
      nextElement: 2,
      type: 'Root',
      props: [],
      children: []
    }

    const stack = [root]

    for (let index = 0; index < length;) {
      const char = input[index]

      if (char === '<') {
        if (input[index + 1] === '!' && input[index + 2] === '-' && input[index + 3] === '-') {
          index = this.parseComment(index + 4, input, length)
        } else if (input[index + 1] === '/') {
          index = this.parseClosingTag(index + 2, input, length, stack)
        } else {
          index = this.parseOpeningTag(index + 1, input, length, stack)
        }
      } else if (char === '{') {
        index = this.parseExpression(index + 1, input, length, stack)
      } else {
        index = this.parseText(index, input, length, stack)
      }
    }

    return root
  }

  static parseAttributes (index, input, length, attributes) {
    while (index < length) {
      let char = input[index]

      if (char === '/' || char === '>') {
        break
      } else if (whitespaceRE.test(char)) {
        index += 1
        continue
      } else {
        let key = ''
        let value
        let expression = false

        while (index < length) {
          char = input[index]

          if (char === '/' || char === '>' || whitespaceRE.test(char)) {
            value = ''
            break
          } else if (char === '=') {
            index += 1
            break
          } else {
            key += char
            index += 1
          }
        }

        if (value === undefined) {
          let quote

          value = ''
          char = input[index]

          if (char === '"' || char === `'`) {
            quote = char
            index += 1
          } else if (char === '{') {
            quote = '}'
            expression = true
            index += 1
          } else {
            quote = valueEndRE
          }

          while (index < length) {
            char = input[index]

            if ((typeof quote === 'object' && quote.test(char)) || char === quote) {
              index += 1

              break
            } else {
              value += char
              index += 1
            }
          }
        }

        let dynamic = false

        if (expression) {
          const template = this.parseTemplate(value)

          value = template.expression
          dynamic = template.dynamic
        }

        attributes[key] = value
      }
    }

    return index
  }

  static parseClosingTag (index, input, length, stack) {
    let type = ''

    for(; index < length; index++) {
      const char = input[index]

      if (char === '>') {
        index += 1
        break
      } else {
        type += char
      }
    }

    const lastElement = stack.pop()
    if (type !== lastElement.type && process.env.MOON_ENV === 'development') {
      error(`Unclosed tag '${lastElement.type}'`)
    }

    return index
  }

  static parseComment (index, input, length) {
    while (index < length) {
      const char0 = input[index]
      const char1 = input[index + 1]
      const char2 = input[index + 2]

      if (char0 === '<' && char1 === '!' && char2 === '-' && input[index + 3] === '-') {
        index = parseComment(index + 4, input, length)
      } else if (char0 === '-' && char1 === '-' && char2 === '>') {
        index += 3

        break
      } else {
        index += 1
      }
    }

    return index
  }

  static parseExpression (index, input, length, stack) {
    let expression = ''

    for (; index < length; index++) {
      const char = input[index]

      if (char === '}') {
        index += 1

        break
      } else {
        expression += char
      }
    }

    const template = this.parseTemplate(expression)

    stack[stack.length - 1].children.push(
      template.expression
    )

    return index
  }

  static parseOpeningTag (index, input, length, stack) {
    const element = {
      type: '',
      props: {},
      children: []
    }

    while (index < length) {
      const char = input[index]

      if (char === '/' || char === '>') {
        const props = element.props
        const lastIndex = stack.length - 1

        if (char === '/') {
          index += 1
        } else {
          stack.push(element)
        }

        for (let i = 0; i < props.length;) {
          const attribute = props[i]

          if (this.isComponentType(Object.keys(attribute)[0])) {
            element = {
              type: attribute.key,
              props: [{
                [Object.keys(attribute)[0]]: Object.values(attribute)[0]
              }],
              children: [element]
            }
            props.splice(i, 1)
          } else {
            i += 1
          }
        }

        stack[lastIndex].children.push(element)

        index += 1

        break
      } else if ((whitespaceRE.test(char) && (index += 1)) || char === '=') {
        index = this.parseAttributes(index, input, length, element.props)
      } else {
        element.type += char
        index += 1
      }
    }

    return index
  }

  static parseTemplate (expression) {
    let dynamic = false

    expression = expression.replace(expressionRE, (match, name) => {
      if (name === undefined || globals.indexOf(name) !== -1) {
        return match
      } else {
        dynamic = true

        if (name[0] === '$') {
          return `locals.${name}`
        } else {
          return `instance.${name}`
        }
      }
    })

    return {
      expression: expression,
      dynamic: dynamic
    }
  }

  static parseText (index, input, length, stack) {
    let content = ''

    for (; index < length; index++) {
      const char = input[index]

      if (char === '<' /* || char === '{' */) {
        break
      } else {
        content += char
      }
    }

    if (!whitespaceRE.test(content)) {
      stack[stack.length - 1].children.push(
        content.replace(escapeRE, (match) => escapeMap[match])
      )
    }

    return index
  }
}
