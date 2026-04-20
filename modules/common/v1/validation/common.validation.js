const joi = require('joi');
module.exports ={
 validateAddPriceCategories :  async(req, res, next) => {
        try{

            const schema = joi.object({
                title: joi.string().required(),
                category: joi.string().required()
            }).unknown(true);

            await schema.validateAsync(req.body);
            return next();

        }catch(error){ return res.error(error?.message); }
    },
validateDeletePriceCategories :  async(req, res, next) => {
        try{

            const schema = joi.object({
                title: joi.string().required(),
                category: joi.string().required()
            }).unknown(true);

            await schema.validateAsync(req.body);
            return next();

        }catch(error){ return res.error(error?.message); }
    },

}

