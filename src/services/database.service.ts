import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, lastValueFrom, of,map,  } from 'rxjs';
import { AxiosResponse ,AxiosRequestConfig} from 'axios';



@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  private baseUrl: string = this.configService.get('BS_BASE_URL');

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

  getProformaPendienteDeEnvio = async () => {
    const url =
      this.baseUrl + this.configService.get('BS_PROFORMA_PENDIENTE_DE_ENVIO');

    let config = { ...this.axiosConfig };

    return lastValueFrom(
      this.httpService.get(url, config).pipe(
        map((axiosResponse: AxiosResponse) => {
          return axiosResponse.data;
        }),

        catchError((err) => {
          this.logger.error('->getProformaPendienteDeEnvio', err);
          return of(null);
        }),
      ),
    );
  };

  async updateEstadoProforma(data: any) {
    const url = this.baseUrl + this.configService.get('BS_UPDATE_ESTADO_PROFORMA');
    let config = { ...this.axiosConfig };

    try {
      const axiosResponse: AxiosResponse = await lastValueFrom(
        this.httpService.put(url, data, config),
      );
      return axiosResponse.data;
    } catch (err) {
      this.logger.error('Error en la actualización de estado', err);

      if (err.response && err.response.data) {
        throw new BadRequestException({
          message:
            err.response.data.message ||
            'Error desconocido en la actualización de estado',
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
