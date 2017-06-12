module.exports = {
    'GET /index': async (ctx, next) => {
        ctx.render('index.html', {
            title: 'concept index'
        });
    }
};
