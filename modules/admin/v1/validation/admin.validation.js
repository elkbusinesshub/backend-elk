const joi = require('joi');

module.exports = {
    getAdminAdsValidation : async(req, res, next) => {
        try{

            const schema = joi.object({
                date: joi.date().optional(),
                loaction: joi.string().optional()
            });

            await schema.validateAsync(req.query);
            return next();

        }catch(error){ return res.error(error?.message); }
    },
    deleteAdminAdValidation : async(req, res, next) => {
        try{

            const schema = joi.object({
                id: joi.number().required()
            });

            await schema.validateAsync(req.query);
            return next();

        }catch(error){ return res.error(error?.message); }

    },
    blockUserByIdValidation : async(req,res,next) => {

        try{

            const schema = joi.object({
                id: joi.number().required()
            });

            await schema.validateAsync(req.query);
            return next();

        }catch(error){ return res.error(error?.message); }

    }


}
