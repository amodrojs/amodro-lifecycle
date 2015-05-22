define('text', {});

define('text!template.html', [], function () {
    return 'main template';
});

define('main', ['text!template.html'], function(template) {
    return {
        name: 'main',
        template: template
    };
});
