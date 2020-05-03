import Bus from './popoverBus';
import Component from './Popover';

/* eslint-disable */
export default {
  install(Vue) {
    const stack = [];
    let counter = 0;

    const $popover = new Vue({
      name: 'Popover',
      methods: {
        closeAll() {
          for (const target of stack) {
            const isOpen = JSON.parse(target.dataset.isOpen);
            const manual = JSON.parse(target.dataset.manual);

            if (!manual && isOpen) {
              Bus.$emit(`popover-${target.dataset.index}:close`);
            }
          }
        },
        closeAllWithOnly() {
          for (const target of stack) {
            const isOpen = JSON.parse(target.dataset.isOpen);
            const isOnly = JSON.parse(target.dataset.only);
            const manual = JSON.parse(target.dataset.manual);

            if (!manual && isOnly && isOpen) {
              Bus.$emit(`popover-${target.dataset.index}:close`);
            }
          }
        },
      },
    });

    function setupListeners(target, index, modifiers, manual) {
      target.dataset.index = index;
      target.dataset.isOpen = false;
      target.dataset.only = !!modifiers.only;
      target.dataset.fixed = !!modifiers.fixed;
      target.dataset.manual = !!manual;

      if (modifiers.hover && !manual) {
        target.dataset.hover = true;
      }

      const isOpen = () => JSON.parse(target.dataset.isOpen);
      const isOnly = () => JSON.parse(target.dataset.only);

      const handleEvent = (event) => {
        if (modifiers.stop) {
          event.stopPropagation();
        }
        if (modifiers.prevent) {
          event.preventDefault();
        }
      };

      const click = (event) => {
        if (isOnly()) {
          if (isOpen()) {
            Bus.$emit(`popover-${index}:close`);
          } else {
            $popover.closeAllWithOnly();
            target.dataset.isOpen = true;
            Bus.$emit(`popover-${index}:open`);
          }
        } else if (isOpen()) {
          Bus.$emit(`popover-${index}:close`);
        } else {
          target.dataset.isOpen = true;
          Bus.$emit(`popover-${index}:open`);
        }
        handleEvent(event);
      };

      const hoverOpen = (event) => {
        if (isOnly()) {
          $popover.closeAllWithOnly();
        }
        target.dataset.isOpen = true;
        Bus.$emit(`popover-${index}:open`);
        handleEvent(event);
      };

      const hoverClose = (event) => {
        Bus.$emit(`popover-${index}:close`);
        handleEvent(event);
      };

      if (!modifiers.hover && !manual) {
        target.addEventListener('click', click);
      }
      if (modifiers.hover && !manual) {
        target.addEventListener('mouseenter', hoverOpen);
        target.addEventListener('mouseleave', hoverClose);
      }
      target.$removeListeners = () => {
        if (!modifiers.hover && !manual) {
          target.removeEventListener('click', click);
        }
        if (modifiers.hover && !manual) {
          target.removeEventListener('mouseenter', hoverOpen);
          target.removeEventListener('mouseleave', hoverClose);
        }
        delete target.dataset.index;
        delete target.dataset.isOpen;
        delete target.dataset.only;
      };
    }

    Vue.prototype.$popover = $popover;

    Vue.component(Component.name, Component);

    Vue.directive('custom-popover', {
      bind(target, bindings) {
        stack.push(target);
        setupListeners(target, counter, bindings.modifiers, bindings.expression);
        counter += 1;
      },
      update(target, bindings) {
        const index = Number(target.dataset.index);
        const isOpen = JSON.parse(target.dataset.isOpen);
        const isOnly = JSON.parse(target.dataset.only);
        const { value = null } = bindings;

        if (value && !isOpen) {
          if (isOnly) {
            $popover.closeAllWithOnly();
          }
          target.dataset.isOpen = true;
          Bus.$emit(`popover-${index}:open`);
        }
        if ((value === false) && isOpen) {
          Bus.$emit(`popover-${index}:close`);
        }
      },
      unbind(target) {
        target.$removeListeners();
        stack.splice(stack.indexOf(target), 1);
      },
    });
  },
};

export {
  Bus,
  Component,
};
