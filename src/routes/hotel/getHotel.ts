import express, { Request, Response } from "express";
import { Hotel } from "../../models/Hotel";
import { Booking } from "../../models/Booking";
import { GatewayCharge } from "../../models/GatewayCharges";
import { exchangeRates } from "exchange-rates-api";
import { SupportedCurrencies } from "../../models/enums/supportedCurrencies";
