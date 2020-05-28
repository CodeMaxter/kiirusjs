export class Component extends HTMLElement {
  constructor (props) {
    super(props)

    this.props = props || {}

    if (this.attributes.length > 0) {
      // Map attributes to props
      for (const attribute of this.attributes) {
        this.props[attribute.name] = attribute.value
      }
    }

    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    this.shadowRoot.innerHTML = this.render()
  }


  // will be overridden
  disconnectedCallback () {
  }

  static define (Component, target, attributes = {}) {
    const tagName = this.getTagName(Component)

    // Check if the custom element is not defined yet
    if (window.customElements.get(tagName) === undefined) {
      window.customElements.define(tagName, Component)
    }

    if (target !== undefined) {
      const instance = new Component(attributes)

      // target.appendChild(instance)
      if (target.childNodes.length > 0) {
        // target.replaceChild(instance, target.childNodes[0])
        target.firstChild.replaceWith(instance)
      } else {
        target.appendChild(instance)
      }

      return instance
    }
  }

  static getTagName (component) {
    return component.name.split(/(?=[A-Z])/g).map((value) => {
      return value.charAt(0).toLowerCase() + value.substring(1)
    }).join('-')
  }

  // will be overridden
  render () { }
}
