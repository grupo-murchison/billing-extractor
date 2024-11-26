import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse, AxiosRequestConfig } from 'axios';

@Injectable()
export class SoftlandGatewayService {
  private readonly logger = new Logger(SoftlandGatewayService.name);

  private baseUrl: string = this.configService.get('SG_BASE_URL');

  private axiosConfig: AxiosRequestConfig = {
    headers: { Authorization: `` },
    timeout: 15000,
  };

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    const token = '';
    this.axiosConfig.headers = { Authorization: `Bearer ${token}` };
  }

  async envioProforma(data: any) {
    const url = this.baseUrl + this.configService.get('SG_ENVIO_DE_PROFORMA');
    let config = { ...this.axiosConfig };

    try {
      const axiosResponse: AxiosResponse = await lastValueFrom(
        this.httpService.post(url, data, config),
      );
      return axiosResponse.data;
    } catch (err) {
      this.logger.error('Error en el proceso de envío de proforma:', err);

      if (err.response && err.response.data) {
        throw new BadRequestException({
          message:
            err.response.data.message ||
            'Error desconocido en el envío de proforma',
          error: 'Bad Request',
          statusCode: 400,
        });
      } else {
        throw new InternalServerErrorException(
          'Error de conexión o de la base de datos',
        );
      }
    }
  }
}
